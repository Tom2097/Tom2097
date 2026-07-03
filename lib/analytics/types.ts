export interface FileData {
  id: string
  name: string
  size: number
  type: string
  created_at: string
  [key: string]: unknown
}

export interface Insight {
  id: string
  title: string
  description: string
  category: string
  confidence: number
  [key: string]: unknown
}

export interface DataPoint {
  id: string
  value: number | string
  timestamp?: string
  [key: string]: unknown
}

export interface QueryResult {
  rows?: Array<Record<string, unknown>>
  summary?: Record<string, unknown>
  points?: DataPoint[]
  [key: string]: unknown
}

export interface SegmentCriteria {
  field: string
  operator: string
  value: unknown
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Analytics engine types
// ---------------------------------------------------------------------------

export type AggregateFn = "count" | "sum" | "avg" | "min" | "max"
export type Granularity = "hour" | "day" | "week" | "month"
export type QueryType = "summary" | "timeseries" | "breakdown"
export type KnownDimension = string

export const AGGREGATES: AggregateFn[] = ["count", "sum", "avg", "min", "max"]
export const GRANULARITIES: Granularity[] = ["hour", "day", "week", "month"]
export const QUERY_TYPES: QueryType[] = ["summary", "timeseries", "breakdown"]

export interface EventInput {
  user_id?: string | null
  event_name: string
  event_category?: string | null
  source?: string | null
  session_id?: string | null
  value?: number | null
  properties?: Record<string, unknown> | null
  occurred_at?: string | null
}

export interface AnalyticsQuery {
  type: QueryType
  event_name: string | null
  event_category: string | null
  aggregate: AggregateFn
  granularity: Granularity
  dimension?: string | null
  limit: number
  start: string
  end: string
}

export interface TimeseriesPoint {
  bucket: string
  value: number
}

export interface BreakdownRow {
  label: string
  value: number
}

export interface AnalyticsSummary {
  total_events: number
  unique_users: number
  distinct_events: number
  total_value: number
}

export interface ReportConfig {
  type: QueryType
  event_name?: string | null
  event_category?: string | null
  aggregate?: AggregateFn | null
  granularity?: Granularity | null
  dimension?: string | null
  range_days?: number
  limit?: number
}

export interface AnalyticsReport {
  id: string
  organization_id: string
  name: string
  description: string | null
  config: ReportConfig
  created_by: string | null
  created_at: string
  updated_at: string
}
