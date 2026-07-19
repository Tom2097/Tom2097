import { createServiceClient } from "@/lib/supabase/service"

/**
 * Platform-wide IP allowlist enforcement.
 *
 * app/api/v1/admin/ip-allowlist/route.ts lets platform admins record CIDR
 * entries in `ip_allowlist_entries` and toggle `ip_allowlist_enabled` in
 * `platform_settings`, but until now nothing read those values back to
 * actually gate a request -- the settings were stored but never enforced.
 * This module is that missing enforcement point. It's called directly from
 * individual admin API routes (not global middleware) so the change stays
 * scoped to app/api/v1/admin/*.
 *
 * IP extraction uses the same header precedence as this app's other
 * request-IP consumers (e.g. lib/middleware/rate-limit.ts's getClientIP(),
 * lib/auth/audit.ts's getClientIp()) for a reverse-proxy setup (Coolify):
 * x-forwarded-for / x-real-ip / cf-connecting-ip. Takes a plain `Request` so
 * it works from both `NextRequest`- and `Request`-typed route handlers.
 */

function extractClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim()

  const xRealIP = request.headers.get("x-real-ip")
  if (xRealIP) return xRealIP

  const cfConnectingIP = request.headers.get("cf-connecting-ip")
  if (cfConnectingIP) return cfConnectingIP

  return "unknown"
}

export interface IpAllowlistCheckResult {
  allowed: boolean
  ip: string
  reason?: string
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet < 0 || octet > 255) return null
    n = (n << 8) | octet
  }
  return n >>> 0
}

/**
 * Checks whether `ip` falls inside `cidr`. Accepts a full CIDR block
 * ("10.0.0.0/8") or a bare host address ("1.2.3.4", treated as /32).
 * IPv6 entries are matched as an exact address or a literal string prefix
 * (no full IPv6 CIDR math -- CIDR entries in this allowlist are expected to
 * be IPv4 in practice).
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const trimmed = cidr.trim()
  if (!trimmed || !ip) return false

  const slash = trimmed.indexOf("/")
  const range = slash === -1 ? trimmed : trimmed.slice(0, slash)
  const prefixLengthStr = slash === -1 ? undefined : trimmed.slice(slash + 1)

  if (ip.includes(":") || range.includes(":")) {
    if (prefixLengthStr === undefined) return ip === range
    return ip.startsWith(range)
  }

  const ipNum = ipv4ToNumber(ip)
  const rangeNum = ipv4ToNumber(range)
  if (ipNum === null || rangeNum === null) return false

  if (prefixLengthStr === undefined) return ipNum === rangeNum

  const prefixLength = Number(prefixLengthStr)
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) return false
  if (prefixLength === 0) return true

  const mask = (0xffffffff << (32 - prefixLength)) >>> 0
  return (ipNum & mask) === (rangeNum & mask)
}

/**
 * Checks the current request's client IP against the platform IP allowlist.
 * Resolves to { allowed: true } whenever allowlisting is disabled (or the
 * setting/entries can't be read -- fails open on infra hiccups the same way
 * the rest of this app's best-effort feature checks do), and fails closed
 * (blocks the request) when enabled but the caller's IP isn't in any entry
 * or couldn't be determined.
 */
export async function checkIpAllowlist(request: Request): Promise<IpAllowlistCheckResult> {
  const ip = extractClientIp(request)
  const db = createServiceClient()

  const { data: setting, error: settingError } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", "ip_allowlist_enabled")
    .maybeSingle()

  if (settingError) {
    console.log("[v0] checkIpAllowlist settings error:", settingError.message)
    return { allowed: true, ip }
  }

  const enabled = Boolean((setting?.value as { enabled?: boolean } | undefined)?.enabled)
  if (!enabled) return { allowed: true, ip }

  if (ip === "unknown") {
    return { allowed: false, ip, reason: "Unable to determine client IP" }
  }

  const { data: entries, error: entriesError } = await db.from("ip_allowlist_entries").select("cidr")
  if (entriesError) {
    console.log("[v0] checkIpAllowlist entries error:", entriesError.message)
    return { allowed: true, ip }
  }

  const allowed = (entries ?? []).some((entry) => isIpInCidr(ip, entry.cidr as string))
  return allowed ? { allowed: true, ip } : { allowed: false, ip, reason: `IP ${ip} is not in the platform allowlist` }
}

/**
 * Throws 'Forbidden' (caught by the route's existing handleAuthError, same
 * as requirePlatformAdmin) unless the request's IP passes the allowlist.
 * Drop-in call for admin routes, right after the platform-admin check:
 *
 *   await requirePlatformAdmin(user.id)
 *   await requireIpAllowlisted(request)
 */
export async function requireIpAllowlisted(request: Request): Promise<void> {
  const result = await checkIpAllowlist(request)
  if (!result.allowed) {
    console.log("[v0] requireIpAllowlisted blocked request:", result.reason)
    throw new Error("Forbidden")
  }
}
