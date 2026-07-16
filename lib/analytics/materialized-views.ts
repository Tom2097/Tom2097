import "server-only"
import { createServiceClient } from "@/lib/supabase/service"

export interface MaterializedView {
  name: string
  query: string
  lastRefreshed: string | null
  rowCount: number
  status: "stale" | "refreshing" | "fresh"
  refreshInterval: number
}

export interface ViewRefreshResult {
  name: string
  rowsInserted: number
  durationMs: number
  success: boolean
}

export interface ScoringCache {
  workspaceId: string
  totalScore: number
  categoryScores: Record<string, number>
  benchmarks: { percentile: number; peerAvg: number } | null
  lastCalculated: string
  stale: boolean
}

const VIEW_QUERIES: Record<string, string> = {
  digit_scores_summary: `SELECT organization_id, metric, AVG(score) AS avg_score, COUNT(*) AS row_count
FROM digit_scores
GROUP BY organization_id, metric`,
  organization_score_benchmarks: `SELECT organization_id,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_score) AS median_overall_score,
  AVG(overall_score) AS avg_overall_score
FROM digit_scores
GROUP BY organization_id`,
}

function isStale(lastRefreshedAt: string | null, refreshIntervalMinutes: number): boolean {
  if (!lastRefreshedAt) return true
  return Date.now() - new Date(lastRefreshedAt).getTime() > refreshIntervalMinutes * 60_000
}

export async function getMaterializedViews(): Promise<MaterializedView[]> {
  const db = createServiceClient()
  const { data: registry } = await db.from("materialized_view_registry").select("*")

  const views = await Promise.all(
    (registry ?? []).map(async (row) => {
      const { data: rowCount } = await db.rpc("count_materialized_view_rows", { view_name: row.name })
      return {
        name: row.name,
        query: VIEW_QUERIES[row.name] ?? "",
        lastRefreshed: row.last_refreshed_at,
        rowCount: Number(rowCount ?? 0),
        status: (isStale(row.last_refreshed_at, row.refresh_interval_minutes) ? "stale" : "fresh") as MaterializedView["status"],
        refreshInterval: row.refresh_interval_minutes,
      }
    }),
  )
  return views
}

export async function refreshView(name: string): Promise<ViewRefreshResult> {
  const db = createServiceClient()
  const { data: registryRow } = await db.from("materialized_view_registry").select("name").eq("name", name).maybeSingle()
  if (!registryRow) throw new Error(`View "${name}" not found`)

  const start = Date.now()
  const { error } = await db.rpc("refresh_known_materialized_view", { view_name: name })
  if (error) return { name, rowsInserted: 0, durationMs: Date.now() - start, success: false }

  const { data: rowCount } = await db.rpc("count_materialized_view_rows", { view_name: name })
  await db.from("materialized_view_registry").update({ last_refreshed_at: new Date().toISOString() }).eq("name", name)

  return { name, rowsInserted: Number(rowCount ?? 0), durationMs: Date.now() - start, success: true }
}

export async function refreshAllViews(): Promise<ViewRefreshResult[]> {
  const db = createServiceClient()
  const { data: registry } = await db.from("materialized_view_registry").select("name")
  const results: ViewRefreshResult[] = []
  for (const row of registry ?? []) {
    results.push(await refreshView(row.name))
  }
  return results
}

/** Real, per-organization scoring derived from digit_scores + organization_score_benchmarks. */
export async function getScoringCache(organizationId: string): Promise<ScoringCache | null> {
  const db = createServiceClient()

  const { data: latest } = await db
    .from("digit_scores")
    .select("overall_score, compliance_score, resources_score, performance_score, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) return null

  const { data: benchmark } = await db
    .from("organization_score_benchmarks")
    .select("median_overall_score, avg_overall_score")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const { data: allBenchmarks } = await db.from("organization_score_benchmarks").select("organization_id, avg_overall_score")
  const rows = allBenchmarks ?? []
  const sorted = rows.map((r) => Number(r.avg_overall_score ?? 0)).sort((a, b) => a - b)
  const myAvg = Number(benchmark?.avg_overall_score ?? latest.overall_score ?? 0)
  const rank = sorted.findIndex((v) => v >= myAvg)
  const percentile = sorted.length > 0 ? Math.round(((rank === -1 ? sorted.length : rank) / sorted.length) * 100) : 0
  const peerAvg = sorted.length > 0 ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0

  return {
    workspaceId: organizationId,
    totalScore: Math.round(Number(latest.overall_score ?? 0)),
    categoryScores: {
      compliance: Math.round(Number(latest.compliance_score ?? 0)),
      resources: Math.round(Number(latest.resources_score ?? 0)),
      performance: Math.round(Number(latest.performance_score ?? 0)),
    },
    benchmarks: { percentile, peerAvg },
    lastCalculated: latest.created_at,
    stale: false,
  }
}
