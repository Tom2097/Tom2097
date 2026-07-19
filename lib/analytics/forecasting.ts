import { createServiceClient } from "@/lib/supabase/service"

export interface ForecastPoint {
  timestamp: string
  actual: number | null
  forecast: number
  lower_bound: number
  upper_bound: number
}

export async function forecastMetric(
  organizationId: string,
  eventName: string,
  periods: number = 12,
): Promise<ForecastPoint[]> {
  const db = createServiceClient()
  const now = new Date()
  const start = new Date(now.getTime() - periods * 30 * 86400000).toISOString()

  const { data } = await db.rpc("analytics_event_timeseries", {
    p_org: organizationId, p_event: eventName, p_category: "",
    p_start: start, p_end: now.toISOString(), p_granularity: "month", p_agg: "count",
  })

  // Read from a single un-mutated array. The old code derived `points` from
  // `data` and then called `.pop()` on `data` itself later on -- `.pop()`
  // mutates in place, so `data` silently lost its last element while
  // `points` (already extracted) kept its original length, leaving the
  // final loop iteration reading an out-of-bounds index (blank timestamp).
  const rows = (data ?? []) as Array<{ bucket: string; value: number }>
  if (rows.length < 3) return []

  const points = rows.map((p) => p.value)
  const mean = points.reduce((a, b) => a + b, 0) / points.length
  const std = Math.sqrt(points.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / points.length)
  const lastBucket = rows[rows.length - 1]?.bucket ?? now.toISOString()

  const results: ForecastPoint[] = []
  for (let i = 0; i < points.length; i++) {
    results.push({
      timestamp: rows[i]?.bucket ?? "",
      actual: points[i], forecast: points[i],
      lower_bound: points[i], upper_bound: points[i],
    })
  }

  // Deterministic trend projection: ordinary-least-squares linear regression
  // over the historical buckets (index -> value), extrapolated forward.
  // Replaces the previous `mean + randomNoise` "forecast", which wasn't a
  // projection at all -- it ignored the actual historical trend and changed
  // on every call.
  const n = points.length
  const xMean = (n - 1) / 2
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (points[i] - mean)
    denominator += (i - xMean) ** 2
  }
  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = mean - slope * xMean

  for (let i = 1; i <= 6; i++) {
    const nextDate = new Date(new Date(lastBucket).getTime() + i * 30 * 86400000)
    const forecast = intercept + slope * (n - 1 + i)
    results.push({
      timestamp: nextDate.toISOString(), actual: null,
      forecast: Math.round(forecast * 100) / 100,
      lower_bound: Math.round((forecast - 1.96 * std) * 100) / 100,
      upper_bound: Math.round((forecast + 1.96 * std) * 100) / 100,
    })
  }

  return results
}

export async function driverDecomposition(organizationId: string): Promise<Array<{ driver: string; contribution: number; direction: "up" | "down" }>> {
  const db = createServiceClient()
  const now = new Date()
  const periodMs = 30 * 86400000
  const currentStart = new Date(now.getTime() - periodMs)
  const priorStart = new Date(now.getTime() - 2 * periodMs)

  const [{ data: currentData }, { data: priorData }] = await Promise.all([
    db.rpc("analytics_event_breakdown", {
      p_org: organizationId, p_event: "", p_category: "", p_dimension: "event_name",
      p_start: currentStart.toISOString(), p_end: now.toISOString(), p_agg: "count", p_limit: 10,
    }),
    db.rpc("analytics_event_breakdown", {
      p_org: organizationId, p_event: "", p_category: "", p_dimension: "event_name",
      p_start: priorStart.toISOString(), p_end: currentStart.toISOString(), p_agg: "count", p_limit: 10,
    }),
  ])

  const rows = (currentData ?? []) as Array<{ label: string; value: number }>
  const priorByLabel = new Map(((priorData ?? []) as Array<{ label: string; value: number }>).map((r) => [r.label, r.value]))
  const total = rows.reduce((a, b) => a + b.value, 0)

  return rows.map((r) => ({
    driver: r.label,
    contribution: total > 0 ? Math.round((r.value / total) * 100) : 0,
    direction: (r.value >= (priorByLabel.get(r.label) ?? 0) ? "up" : "down") as "up" | "down",
  }))
}
