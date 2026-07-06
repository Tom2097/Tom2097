export interface MaterializedView {
  name: string
  query: string
  lastRefreshed: string | null
  rowCount: number
  status: 'stale' | 'refreshing' | 'fresh'
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

const VIEW_DEFINITIONS: MaterializedView[] = [
  {
    name: 'digit_scores_summary',
    query: `SELECT category, AVG(score) as avg_score, COUNT(*) as count
FROM digit_scores
GROUP BY category`,
    lastRefreshed: '2026-07-05T22:00:00Z',
    rowCount: 1240,
    status: 'fresh',
    refreshInterval: 60,
  },
  {
    name: 'workspace_benchmarks',
    query: `SELECT workspace_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score) as median_score
FROM digit_scores
GROUP BY workspace_id`,
    lastRefreshed: '2026-07-05T06:00:00Z',
    rowCount: 89,
    status: 'stale',
    refreshInterval: 240,
  },
  {
    name: 'driver_impact',
    query: `SELECT driver_id, AVG(impact_score) as avg_impact, COUNT(DISTINCT workspace_id) as affected_workspaces
FROM driver_events
GROUP BY driver_id`,
    lastRefreshed: '2026-07-06T00:00:00Z',
    rowCount: 456,
    status: 'fresh',
    refreshInterval: 120,
  },
  {
    name: 'cohort_percentiles',
    query: `SELECT cohort, PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY score) as p25,
PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score) as p50,
PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score) as p75
FROM digit_scores
GROUP BY cohort`,
    lastRefreshed: null,
    rowCount: 0,
    status: 'stale',
    refreshInterval: 360,
  },
]

const SCORING_CACHES = new Map<string, ScoringCache>()

export function getMaterializedViews(): MaterializedView[] {
  return VIEW_DEFINITIONS
}

export function refreshView(name: string): ViewRefreshResult {
  const view = VIEW_DEFINITIONS.find((v) => v.name === name)
  if (!view) throw new Error(`View "${name}" not found`)
  view.status = 'refreshing'
  const start = Date.now()
  const rowsInserted = Math.floor(Math.random() * 500) + view.rowCount
  const durationMs = Date.now() - start + Math.floor(Math.random() * 200) + 50
  view.status = 'fresh'
  view.lastRefreshed = new Date().toISOString()
  view.rowCount = rowsInserted
  return { name, rowsInserted, durationMs, success: true }
}

export function refreshAllViews(): ViewRefreshResult[] {
  return VIEW_DEFINITIONS.map((v) => refreshView(v.name))
}

export function getScoringCache(workspaceId: string): ScoringCache {
  const existing = SCORING_CACHES.get(workspaceId)
  if (existing) return existing

  const cache: ScoringCache = {
    workspaceId,
    totalScore: Math.floor(Math.random() * 400) + 600,
    categoryScores: {
      operational: Math.floor(Math.random() * 200) + 400,
      financial: Math.floor(Math.random() * 150) + 300,
      compliance: Math.floor(Math.random() * 100) + 200,
      innovation: Math.floor(Math.random() * 80) + 100,
    },
    benchmarks: {
      percentile: Math.floor(Math.random() * 40) + 30,
      peerAvg: Math.floor(Math.random() * 300) + 500,
    },
    lastCalculated: new Date().toISOString(),
    stale: false,
  }
  SCORING_CACHES.set(workspaceId, cache)
  return cache
}

export function invalidateScoringCache(workspaceId: string): void {
  const cache = SCORING_CACHES.get(workspaceId)
  if (cache) {
    cache.stale = true
  }
}
