import { createServiceClient } from "@/lib/supabase/service"

export interface CohortBenchmark {
  cohort: string
  metric: string
  value: number
  p10: number
  p50: number
  p90: number
  percentile: number
  sampleSize: number
  peerComparison: boolean
}

const ORG_DIMENSION_COLUMNS = ["industry", "size", "region"]

// Minimum number of *other* organizations sharing the caller's cohort
// dimension before we treat a percentile as a real peer comparison. Below
// this, revealing p10/p50/p90 computed from a handful of named competitors'
// raw event totals would be a privacy problem, not a benchmark -- so we fall
// back to reporting the org's own value instead of fabricating a percentile
// from a cohort that's really just "you". Mirrors the k-anonymity threshold
// used for cross-tenant score comparisons in cohort-benchmarking.ts.
const MIN_PEER_ORGS_FOR_COMPARISON = 5

/**
 * This used to only ever query the caller's own organization_id, then fake a
 * "percentile vs industry cohort" by splitting that org's own events into
 * sub-groups by an event property -- never comparing against any other
 * tenant despite the UI calling it an industry/peer comparison. It now
 * actually looks up peer organizations sharing the same dimension value
 * (same pattern as lib/analytics/cohort-benchmarking.ts's peer lookup) and
 * compares the caller's aggregate against theirs.
 */
export async function getCohortBenchmarks(
  organizationId: string,
  metric: string,
  cohortDimension: string = "industry",
): Promise<CohortBenchmark[]> {
  const db = createServiceClient()
  const now = new Date()
  const start = new Date(now.getTime() - 90 * 86400000).toISOString()

  const dimensionColumn = ORG_DIMENSION_COLUMNS.includes(cohortDimension) ? cohortDimension : "industry"

  const { data: org } = await db
    .from("organizations")
    .select(dimensionColumn)
    .eq("id", organizationId)
    .single()

  const dimensionValue = (org as Record<string, string | null> | null)?.[dimensionColumn] ?? null

  let peerIds: string[] = []
  if (dimensionValue) {
    const { data: peers } = await db
      .from("organizations")
      .select("id")
      .eq(dimensionColumn, dimensionValue)
      .neq("id", organizationId)
    peerIds = ((peers ?? []) as Array<{ id: string }>).map((p) => p.id)
  }

  const cohortLabel = dimensionValue ?? "unknown"
  const hasPeerData = peerIds.length >= MIN_PEER_ORGS_FOR_COMPARISON
  const orgIdsToQuery = hasPeerData ? [organizationId, ...peerIds] : [organizationId]

  const { data: events } = await db
    .from("analytics_events")
    .select("organization_id, value")
    .in("organization_id", orgIdsToQuery)
    .eq("event_name", metric)
    .gte("occurred_at", start)

  const totalsByOrg = new Map<string, number>()
  for (const e of (events ?? []) as Array<{ organization_id: string; value: number | null }>) {
    totalsByOrg.set(e.organization_id, (totalsByOrg.get(e.organization_id) ?? 0) + (e.value ?? 1))
  }

  const selfValue = totalsByOrg.get(organizationId) ?? 0

  if (!hasPeerData) {
    // Not enough peer organizations in this cohort to compare against
    // safely -- report the org's own value/trend rather than a fabricated
    // peer percentile.
    return [{
      cohort: cohortLabel,
      metric,
      value: Math.round(selfValue * 100) / 100,
      p10: selfValue,
      p50: selfValue,
      p90: selfValue,
      percentile: 50,
      sampleSize: 1,
      peerComparison: false,
    }]
  }

  const peerValues = peerIds.map((id) => totalsByOrg.get(id) ?? 0).sort((a, b) => a - b)
  const p10 = peerValues[Math.floor(peerValues.length * 0.1)] ?? 0
  const p50 = peerValues[Math.floor(peerValues.length * 0.5)] ?? 0
  const p90 = peerValues[Math.floor(peerValues.length * 0.9)] ?? 0

  let rank = 0
  for (const v of peerValues) { if (v < selfValue) rank++ }
  const percentile = peerValues.length > 0 ? Math.round((rank / peerValues.length) * 100) : 50

  return [{
    cohort: cohortLabel,
    metric,
    value: Math.round(selfValue * 100) / 100,
    p10,
    p50,
    p90,
    percentile,
    sampleSize: peerIds.length + 1,
    peerComparison: true,
  }]
}
