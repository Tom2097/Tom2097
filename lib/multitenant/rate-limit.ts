import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

/**
 * Distributed, per-tenant rate limiting backed by Upstash Redis.
 *
 * Limits are enforced across ALL serverless instances because state lives in
 * Redis (not process memory). Two sliding windows are enforced per tenant: a
 * per-minute burst limit and a per-hour sustained limit.
 *
 * If the Upstash env vars are absent (e.g. local dev without the integration),
 * we transparently fall back to an in-memory limiter so the app still runs.
 */

const hasRedis = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

const redis = hasRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null

// Ratelimit instances are cheap config holders; cache one per (window,limit).
const limiterCache = new Map<string, Ratelimit>()

function getLimiter(window: "minute" | "hour", limit: number): Ratelimit {
  const key = `${window}:${limit}`
  let limiter = limiterCache.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, window === "minute" ? "1 m" : "1 h"),
      prefix: `rl:${window === "minute" ? "min" : "hr"}`,
      analytics: false,
    })
    limiterCache.set(key, limiter)
  }
  return limiter
}

/* -------------------------------------------------------------------------- */
/* In-memory fallback (dev only / Redis unavailable)                          */
/* -------------------------------------------------------------------------- */

class RateLimitStore {
  private store = new Map<
    string,
    { count: number; resetTime: number; minuteCount: number; minuteResetTime: number }
  >()
  private readonly HOUR_MS = 60 * 60 * 1000
  private readonly MINUTE_MS = 60 * 1000

  check(key: string, hourlyLimit = 1000, minuteLimit = 100) {
    const now = Date.now()
    let entry = this.store.get(key)
    if (!entry || now >= entry.resetTime) {
      entry = { count: 0, resetTime: now + this.HOUR_MS, minuteCount: 0, minuteResetTime: now + this.MINUTE_MS }
      this.store.set(key, entry)
    }
    if (now >= entry.minuteResetTime) {
      entry.minuteCount = 0
      entry.minuteResetTime = now + this.MINUTE_MS
    }
    if (entry.count >= hourlyLimit || entry.minuteCount >= minuteLimit) {
      return { allowed: false, minuteRemaining: 0, minuteResetIn: Math.ceil((entry.minuteResetTime - now) / 1000) }
    }
    entry.count++
    entry.minuteCount++
    return {
      allowed: true,
      minuteRemaining: Math.max(0, minuteLimit - entry.minuteCount),
      minuteResetIn: Math.ceil((entry.minuteResetTime - now) / 1000),
    }
  }

  stats(key: string, minuteLimit = 100) {
    const entry = this.store.get(key)
    if (!entry) return { minuteRemaining: minuteLimit, minuteResetIn: 60 }
    const now = Date.now()
    return {
      minuteRemaining: Math.max(0, minuteLimit - entry.minuteCount),
      minuteResetIn: Math.ceil((entry.minuteResetTime - now) / 1000),
    }
  }
}

const memoryStore = new RateLimitStore()

/* -------------------------------------------------------------------------- */
/* Public API (async)                                                         */
/* -------------------------------------------------------------------------- */

interface LimitOutcome {
  allowed: boolean
  minuteLimit: number
  minuteRemaining: number
  retryAfter: number
}

async function evaluate(tenantId: string, hourlyLimit: number, minuteLimit: number): Promise<LimitOutcome> {
  const identifier = `tenant:${tenantId}`

  if (!redis) {
    const r = memoryStore.check(identifier, hourlyLimit, minuteLimit)
    return { allowed: r.allowed, minuteLimit, minuteRemaining: r.minuteRemaining, retryAfter: r.minuteResetIn || 60 }
  }

  // Check the per-minute window first (the common limiter), then the hour.
  const minute = await getLimiter("minute", minuteLimit).limit(identifier)
  if (!minute.success) {
    return {
      allowed: false,
      minuteLimit,
      minuteRemaining: 0,
      retryAfter: Math.max(1, Math.ceil((minute.reset - Date.now()) / 1000)),
    }
  }

  const hour = await getLimiter("hour", hourlyLimit).limit(identifier)
  if (!hour.success) {
    return {
      allowed: false,
      minuteLimit,
      minuteRemaining: minute.remaining,
      retryAfter: Math.max(1, Math.ceil((hour.reset - Date.now()) / 1000)),
    }
  }

  return { allowed: true, minuteLimit, minuteRemaining: minute.remaining, retryAfter: 0 }
}

/**
 * Check rate limit and return a 429 response if exceeded, else null.
 * Usage:
 *   const limited = await checkTenantRateLimit(ctx.tenantId)
 *   if (limited) return limited
 */
export async function checkTenantRateLimit(
  tenantId: string,
  hourlyLimit = 1000,
  minuteLimit = 100,
): Promise<NextResponse | null> {
  const outcome = await evaluate(tenantId, hourlyLimit, minuteLimit)
  if (outcome.allowed) return null

  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later.",
      retryAfter: outcome.retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(outcome.retryAfter),
        "X-RateLimit-Limit": String(outcome.minuteLimit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(outcome.retryAfter),
      },
    },
  )
}

/** Backwards-compatible alias. */
export const createRateLimitResponse = checkTenantRateLimit

/**
 * Add rate limit headers to a successful response WITHOUT consuming a token.
 */
export async function addRateLimitHeaders(
  response: NextResponse,
  tenantId: string,
  minuteLimit = 100,
): Promise<NextResponse> {
  const identifier = `tenant:${tenantId}`

  if (!redis) {
    const s = memoryStore.stats(identifier, minuteLimit)
    response.headers.set("X-RateLimit-Limit", String(minuteLimit))
    response.headers.set("X-RateLimit-Remaining", String(s.minuteRemaining))
    response.headers.set("X-RateLimit-Reset", String(s.minuteResetIn))
    return response
  }

  try {
    const { remaining, reset } = await getLimiter("minute", minuteLimit).getRemaining(identifier)
    response.headers.set("X-RateLimit-Limit", String(minuteLimit))
    response.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)))
    response.headers.set("X-RateLimit-Reset", String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))))
  } catch {
    // Non-fatal: headers are advisory.
  }
  return response
}
