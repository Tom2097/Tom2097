import { NextResponse } from "next/server"

/**
 * In-memory rate limiter for development
 * For production, upgrade to Redis/Upstash
 */
class RateLimitStore {
  private store: Map<
    string,
    { count: number; resetTime: number; minuteCount: number; minuteResetTime: number }
  > = new Map()

  private readonly HOUR_MS = 60 * 60 * 1000
  private readonly MINUTE_MS = 60 * 1000

  check(key: string, hourlyLimit: number = 1000, minuteLimit: number = 100): boolean {
    const now = Date.now()
    let entry = this.store.get(key)

    // Initialize or reset if hour expired
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.HOUR_MS,
        minuteCount: 0,
        minuteResetTime: now + this.MINUTE_MS,
      }
      this.store.set(key, entry)
    }

    // Reset minute counter if minute expired
    if (now >= entry.minuteResetTime) {
      entry.minuteCount = 0
      entry.minuteResetTime = now + this.MINUTE_MS
    }

    // Check both limits
    if (entry.count >= hourlyLimit || entry.minuteCount >= minuteLimit) {
      return false
    }

    // Increment counters
    entry.count++
    entry.minuteCount++

    return true
  }

  getStats(key: string) {
    const entry = this.store.get(key)
    if (!entry) return null

    const now = Date.now()
    return {
      hourlyRequests: entry.count,
      minuteRequests: entry.minuteCount,
      hourlyResetIn: Math.ceil((entry.resetTime - now) / 1000),
      minuteResetIn: Math.ceil((entry.minuteResetTime - now) / 1000),
    }
  }

  reset(key: string) {
    this.store.delete(key)
  }

  // Cleanup old entries periodically (every 6 hours)
  cleanup() {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime + this.HOUR_MS) {
        this.store.delete(key)
        cleaned++
      }
    }

    console.log(`[v0] Rate limit cleanup: removed ${cleaned} old entries`)
  }
}

export const rateLimitStore = new RateLimitStore()

// Schedule cleanup every 6 hours
setInterval(() => {
  rateLimitStore.cleanup()
}, 6 * 60 * 60 * 1000)

/**
 * Rate limiting middleware for tenant APIs
 * Returns 429 (Too Many Requests) if limit exceeded
 */
export function createRateLimitResponse(
  tenantId: string,
  hourlyLimit: number = 1000,
  minuteLimit: number = 100
): NextResponse | null {
  const key = `tenant:${tenantId}`
  const allowed = rateLimitStore.check(key, hourlyLimit, minuteLimit)

  if (!allowed) {
    const stats = rateLimitStore.getStats(key)
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: stats?.minuteResetIn || 60,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(stats?.minuteResetIn || 60),
          'X-RateLimit-Limit': String(minuteLimit),
          'X-RateLimit-Remaining': String(
            Math.max(0, minuteLimit - (stats?.minuteRequests || 0))
          ),
          'X-RateLimit-Reset': String(stats?.minuteResetIn || 60),
        },
      }
    )
  }

  return null
}

/**
 * Middleware to add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  tenantId: string,
  minuteLimit: number = 100
): NextResponse {
  const key = `tenant:${tenantId}`
  const stats = rateLimitStore.getStats(key)

  if (stats) {
    response.headers.set('X-RateLimit-Limit', String(minuteLimit))
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, minuteLimit - stats.minuteRequests)))
    response.headers.set('X-RateLimit-Reset', String(stats.minuteResetIn))
  }

  return response
}

/**
 * Check rate limit and return 429 if exceeded
 * Usage in API routes:
 *   const rateLimitResponse = checkTenantRateLimit(tenantContext.tenantId)
 *   if (rateLimitResponse) return rateLimitResponse
 */
export function checkTenantRateLimit(
  tenantId: string,
  hourlyLimit: number = 1000,
  minuteLimit: number = 100
): NextResponse | null {
  return createRateLimitResponse(tenantId, hourlyLimit, minuteLimit)
}
