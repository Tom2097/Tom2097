import { createServiceClient } from "@/lib/supabase/service"

export interface CohortBenchmark {
  cohort: string
  metric: string
  value: number
  p10: number
  p50: number
  p90: number
  percentile: number
}

export async function getCohortBenchmarks(
  organizationId: string,
  metric: string,
  cohortDimension: string = "industry",
): Promise<CohortBenchmark[]> {
  const db = createServiceClient()
  const now = new Date()
  const start = new Date(now.getTime() - 90 * 86400000).toISOString()

  const { data: events } = await db
    .from("analytics_events")
    .select(`event_name, value, properties->>${cohortDimension} as cohort`)
    .eq("organization_id", organizationId)
    .eq("event_name", metric)
    .gte("occurred_at", start)

  const groups = new Map<string, number[]>()
  for (const e of (events ?? []) as Array<{ value: number; cohort: string | null }>) {
    const key = e.cohort ?? "unknown"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e.value ?? 1)
  }

  const results: CohortBenchmark[] = []
  for (const [cohort, values] of groups) {
    const sorted = values.sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)
    const mean = sum / sorted.length
    const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? 0
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0

    // Our org's percentile in this cohort (simplified: where does our mean fall)
    const allValues = [...sorted].sort((a, b) => a - b)
    let rank = 0
    for (const v of allValues) { if (v < mean) rank++ }
    const percentile = allValues.length > 0 ? Math.round((rank / allValues.length) * 100) : 50

    results.push({ cohort, metric, value: Math.round(mean * 100) / 100, p10, p50, p90, percentile })
  }

  return results.sort((a, b) => b.value - a.value)
}
