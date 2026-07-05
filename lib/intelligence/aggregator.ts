import { createServiceClient } from "@/lib/supabase/service"
import { Deal, Batch, Finding } from "./types"

export interface CrossTenantMetric {
  metric: string
  yourValue: number
  peerAverage: number
  topDecile: number
  percentile: number
  sampleSize: number
  industry: string
}

export interface PeerComparison {
  metric: string
  yourValue: number
  peerAverage: number
  gap: number
  gapPercent: number
  recommendation: string
}

const INSIGHTS_TABLE = "intelligence_network_insights"

export async function getCrossTenantBenchmarks(
  organizationId: string,
): Promise<CrossTenantMetric[]> {
  const db = createServiceClient()

  const { data: org } = await db
    .from("organizations")
    .select("industry")
    .eq("id", organizationId)
    .single()

  const industry = (org?.industry as string) || null

  const metrics = await computeOrgMetrics(organizationId)

  const result: CrossTenantMetric[] = []

  for (const [metric, yourValue] of Object.entries(metrics)) {
    const stats = await getPeerStats(metric, industry)
    if (stats.count > 0) {
      const percentile = computePercentile(yourValue, stats.values)
      result.push({
        metric,
        yourValue,
        peerAverage: Math.round(stats.average),
        topDecile: Math.round(stats.topDecile),
        percentile,
        sampleSize: stats.count,
        industry: industry || "all",
      })
    } else {
      result.push({
        metric,
        yourValue,
        peerAverage: yourValue,
        topDecile: Math.round(yourValue * 1.2),
        percentile: 50,
        sampleSize: 0,
        industry: industry || "all",
      })
    }
  }

  return result
}

export async function getPeerComparisons(
  organizationId: string,
): Promise<PeerComparison[]> {
  const benchmarks = await getCrossTenantBenchmarks(organizationId)
  return benchmarks.map((b) => {
    const gap = b.yourValue - b.peerAverage
    const gapPercent = b.peerAverage > 0 ? Math.round((gap / b.peerAverage) * 10000) / 100 : 0
    const isPositiveGap = isPositiveMetric(b.metric) ? gap > 0 : gap < 0
    return {
      metric: b.metric,
      yourValue: b.yourValue,
      peerAverage: b.peerAverage,
      gap,
      gapPercent,
      recommendation: isPositiveGap
        ? `Your ${b.metric} outperforms peers by ${Math.abs(gapPercent)}%`
        : `Your ${b.metric} lags peers by ${Math.abs(gapPercent)}% — consider reviewing processes`,
    }
  })
}

export async function recordMetric(
  organizationId: string,
  metric: string,
  value: number,
): Promise<void> {
  const db = createServiceClient()
  const { data: org } = await db
    .from("organizations")
    .select("industry, employee_count")
    .eq("id", organizationId)
    .single()

  if (!org) return

  await db.from(INSIGHTS_TABLE).insert({
    organization_id: organizationId,
    metric,
    value,
    industry: (org.industry as string) || "unknown",
    employee_range: (org.employee_count as string) || "unknown",
    recorded_at: new Date().toISOString(),
  })
}

export async function collectMetrics(organizationId: string): Promise<void> {
  const metrics = await computeOrgMetrics(organizationId)
  for (const [metric, value] of Object.entries(metrics)) {
    await recordMetric(organizationId, metric, value)
  }
}

async function computeOrgMetrics(organizationId: string): Promise<Record<string, number>> {
  const db = createServiceClient()

  const { data: deals } = await db
    .from("deals")
    .select("value")
    .eq("organization_id", organizationId)
    .eq("status", "open")
   const pipelineValue = (deals || []).reduce((s: number, d: { value?: number }) => s + (d.value || 0), 0)

  const { count: certCount } = await db
    .from("certificates")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  const { data: batches } = await db
    .from("production_batches")
    .select("throughput")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("completed_at", new Date(Date.now() - 30 * 86400000).toISOString())

  const avgThroughput = batches && batches.length > 0
    ? batches.reduce((s: number, b: any) => s + (b.throughput || 0), 0) / batches.length
    : 0

  const { data: findings } = await db
    .from("intelligence_findings")
    .select("monetary_risk")
    .eq("organization_id", organizationId)
    .eq("status", "active")
  const riskExposure = (findings || []).reduce((s: number, f: any) => s + (f.monetary_risk || 0), 0)

  const { count: completedBatches } = await db
    .from("production_batches")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("completed_at", new Date(Date.now() - 7 * 86400000).toISOString())

  return {
    pipeline_value: pipelineValue,
    active_certifications: certCount || 0,
    avg_throughput: Math.round(avgThroughput * 100) / 100,
    risk_exposure: riskExposure,
    weekly_batch_completions: completedBatches || 0,
  }
}

async function getPeerStats(
  metric: string,
  industry: string | null,
): Promise<{ count: number; average: number; topDecile: number; values: number[] }> {
  const db = createServiceClient()
  let query = db
    .from(INSIGHTS_TABLE)
    .select("value")
    .eq("metric", metric)

  if (industry) {
    query = query.eq("industry", industry)
  }

  const { data } = await query.limit(1000)
  if (!data || data.length === 0) {
    return { count: 0, average: 0, topDecile: 0, values: [] }
  }

  const values = (data as Array<{ value: number }>).map((r) => r.value).sort((a, b) => a - b)
  const average = values.reduce((s, v) => s + v, 0) / values.length
  const topDecileIndex = Math.floor(values.length * 0.9)
  const topDecile = values[topDecileIndex] || values[values.length - 1]

  return { count: values.length, average, topDecile, values }
}

function computePercentile(value: number, peers: number[]): number {
  if (peers.length === 0) return 50
  const below = peers.filter((p) => p <= value).length
  return Math.round((below / peers.length) * 100)
}

function isPositiveMetric(metric: string): boolean {
  const inverseMetrics = ["risk_exposure", "churn_rate", "cost"]
  return !inverseMetrics.some((m) => metric.includes(m))
}
