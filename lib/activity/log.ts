import { createServerClient } from "@supabase/ssr"
import type { NextRequest } from "next/server"

// Activity logging: every page visit and API call by a signed-in user is
// written to public.activity_logs (see supabase/migrations/20261108000004).
// Called from middleware.ts; the insert runs after the response via
// event.waitUntil, so it never slows a request down or breaks one.

export type ActivityKind = "page" | "api"

export interface ActivityEntry {
  userId: string
  kind: ActivityKind
  method: string
  path: string
  query: string | null
  referrer: string | null
  ip: string | null
  userAgent: string | null
}

// High-frequency or machine endpoints that would drown out real activity.
const SKIP_API_PREFIXES = ["/api/health", "/api/v1/track/", "/api/webhooks/"]

// Query parameters that can carry secrets (auth codes, reset tokens, keys).
const SENSITIVE_PARAMS = /^(code|token|access_token|refresh_token|id_token|password|secret|key|api_key|otp|signature|sig)$/i

const MAX_FIELD = 500

function truncate(value: string | null, max = MAX_FIELD): string | null {
  if (!value) return null
  return value.length > max ? value.slice(0, max) : value
}

export function redactQuery(search: URLSearchParams): string | null {
  const parts: string[] = []
  search.forEach((value, name) => {
    parts.push(`${name}=${SENSITIVE_PARAMS.test(name) ? "[redacted]" : value}`)
  })
  return parts.length ? truncate(parts.join("&")) : null
}

/** Prefetches are the router warming its cache, not something the user did. */
export function isPrefetch(request: NextRequest): boolean {
  const h = request.headers
  return (
    h.has("next-router-prefetch") ||
    h.get("purpose") === "prefetch" ||
    h.get("sec-purpose")?.includes("prefetch") === true
  )
}

export function shouldLogApi(pathname: string): boolean {
  return !SKIP_API_PREFIXES.some((p) => pathname.startsWith(p))
}

/**
 * The signed-in user's id for an API request, verified from the session
 * cookie. The project signs JWTs with an asymmetric (ES256) key, so
 * getClaims() checks the signature locally against the cached JWKS instead of
 * calling the auth server on every request. Read-only: it never refreshes or
 * sets cookies.
 */
export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return null

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
    })
    const { data } = await supabase.auth.getClaims()
    const sub = data?.claims?.sub
    return typeof sub === "string" ? sub : null
  } catch {
    return null
  }
}

export function buildEntry(request: NextRequest, userId: string, kind: ActivityKind): ActivityEntry {
  const h = request.headers
  const forwarded = h.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip")
  return {
    userId,
    kind,
    method: request.method,
    path: truncate(request.nextUrl.pathname) ?? "/",
    query: redactQuery(request.nextUrl.searchParams),
    referrer: truncate(h.get("referer")),
    ip: ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null,
    userAgent: truncate(h.get("user-agent")),
  }
}

/** Writes one entry with the service role. Never throws. */
export async function writeActivity(entry: ActivityEntry): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return

  try {
    await fetch(`${url}/rest/v1/activity_logs`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: entry.userId,
        kind: entry.kind,
        method: entry.method,
        path: entry.path,
        query: entry.query,
        referrer: entry.referrer,
        ip_address: entry.ip,
        user_agent: entry.userAgent,
      }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Logging must never affect the request.
  }
}
