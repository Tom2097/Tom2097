import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/service"

export interface SiteVisit {
  id: string
  path: string
  referrer: string | null
  country: string | null
  country_code: string | null
  city: string | null
  region_name: string | null
  device_type: string | null
  session_id: string
  created_at: string
}

export interface CountryBreakdown {
  country: string
  country_code: string | null
  visits: number
}

export interface VisitorSnapshot {
  totalVisits: number
  uniqueVisitors: number
  last24h: number
  topCountries: CountryBreakdown[]
  topPages: { path: string; visits: number }[]
  /** Where visitors came from (referrer hostname, or "direct"), recent visits only. */
  topReferrers: { source: string; visits: number }[]
  /** Last-30-days funnel: unique visitor sessions -> new workspaces -> trials started. */
  funnel30d: { visitors: number; signups: number; trials: number }
  recentVisits: SiteVisit[]
}

const GEO_LOOKUP_TIMEOUT_MS = 1500

interface GeoResult {
  country: string | null
  countryCode: string | null
  city: string | null
  regionName: string | null
}

/**
 * ip-api.com's free, keyless tier (45 req/min, plenty for a self-hosted
 * marketing site) -- chosen over standing up Cloudflare (a bigger,
 * separate infra change: nameserver migration) or a local GeoIP database
 * (an extra dependency + update pipeline for a feature this simple).
 * Short timeout + swallowed failure: a slow/down geo provider must never
 * be the reason a visit fails to record.
 */
async function lookupGeo(ip: string): Promise<GeoResult> {
  const empty: GeoResult = { country: null, countryCode: null, city: null, regionName: null }
  if (!ip || ip === "127.0.0.1" || ip === "::1") return empty

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`,
      { signal: AbortSignal.timeout(GEO_LOOKUP_TIMEOUT_MS) },
    )
    if (!res.ok) return empty
    const data = await res.json()
    if (data.status !== "success") return empty
    return {
      country: data.country ?? null,
      countryCode: data.countryCode ?? null,
      city: data.city ?? null,
      regionName: data.regionName ?? null,
    }
  } catch {
    return empty
  }
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex")
}

function detectDeviceType(userAgent: string | null): string | null {
  if (!userAgent) return null
  return /mobile|android|iphone|ipad/i.test(userAgent) ? "mobile" : "desktop"
}

export interface RecordVisitInput {
  path: string
  referrer: string | null
  sessionId: string
  ip: string | null
  userAgent: string | null
}

/** Records one page view. Geo lookup happens inline (not via a background
 *  job) -- ip-api.com is typically ~100-300ms and the call is already
 *  fire-and-forget from the browser's side (sendBeacon), so route latency
 *  here never blocks page render; a job-queue round trip would only add
 *  up-to-a-minute delay before the country shows up, for no real benefit. */
export async function recordVisit(input: RecordVisitInput): Promise<void> {
  const db = createServiceClient()
  const geo = input.ip ? await lookupGeo(input.ip) : { country: null, countryCode: null, city: null, regionName: null }

  await db.from("site_visits").insert({
    path: input.path.slice(0, 500),
    referrer: input.referrer?.slice(0, 500) ?? null,
    country: geo.country,
    country_code: geo.countryCode,
    city: geo.city,
    region_name: geo.regionName,
    ip_hash: input.ip ? hashIp(input.ip) : null,
    user_agent: input.userAgent?.slice(0, 500) ?? null,
    device_type: detectDeviceType(input.userAgent),
    session_id: input.sessionId,
  })
}

export async function getVisitorSnapshot(): Promise<VisitorSnapshot> {
  const db = createServiceClient()

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalVisits },
    { data: last24hRows },
    { data: recentRows },
    { data: sessions30dRows },
    { count: signups30d },
    { count: trials30d },
  ] = await Promise.all([
    db.from("site_visits").select("id", { count: "exact", head: true }),
    db
      .from("site_visits")
      .select("id")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    db
      .from("site_visits")
      .select("id, path, referrer, country, country_code, city, region_name, device_type, session_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("site_visits").select("session_id").gte("created_at", since30d).limit(20000),
    db.from("organizations").select("id", { count: "exact", head: true }).gte("created_at", since30d),
    db.from("subscriptions").select("id", { count: "exact", head: true }).gte("created_at", since30d),
  ])

  const rows = (recentRows ?? []) as SiteVisit[]
  const uniqueVisitors = new Set(rows.map((r) => r.session_id)).size

  const countryCounts = new Map<string, { country: string; country_code: string | null; visits: number }>()
  const pageCounts = new Map<string, number>()
  for (const row of rows) {
    if (row.country) {
      const key = row.country
      const existing = countryCounts.get(key)
      if (existing) existing.visits++
      else countryCounts.set(key, { country: row.country, country_code: row.country_code, visits: 1 })
    }
    pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1)
  }

  const referrerCounts = new Map<string, number>()
  for (const row of rows) {
    const source = referrerSource(row.referrer)
    referrerCounts.set(source, (referrerCounts.get(source) ?? 0) + 1)
  }
  const topReferrers = Array.from(referrerCounts.entries())
    .map(([source, visits]) => ({ source, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8)

  const topCountries = Array.from(countryCounts.values()).sort((a, b) => b.visits - a.visits).slice(0, 8)
  const topPages = Array.from(pageCounts.entries())
    .map(([path, visits]) => ({ path, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8)

  return {
    totalVisits: totalVisits ?? 0,
    uniqueVisitors,
    last24h: last24hRows?.length ?? 0,
    topCountries,
    topPages,
    topReferrers,
    funnel30d: {
      visitors: new Set((sessions30dRows ?? []).map((r: { session_id: string }) => r.session_id)).size,
      signups: signups30d ?? 0,
      trials: trials30d ?? 0,
    },
    recentVisits: rows.slice(0, 30),
  }
}

/** Collapses a referrer URL to its hostname; internal navigation and no-referrer both count as "direct". */
export function referrerSource(referrer: string | null): string {
  if (!referrer) return "direct"
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "")
    return host === "digit-ai.org" || host === "localhost" ? "direct" : host
  } catch {
    return "direct"
  }
}
