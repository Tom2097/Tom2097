/**
 * Module #7: Analytics Engine — shared types.
 *
 * The engine ingests tenant-scoped events into `analytics_events` and answers
 * aggregate queries (timeseries / breakdown / summary) via SECURITY DEFINER
 * SQL functions. Saved query definitions live in `analytics_reports`.
 *
 * All access is org-scoped: callers go through withAuth and pass the validated
 * organizationId to every store/engine function — never a client-supplied org.
 */

export type AggregateFn = "count" | "sum" | "avg" | "min" | "max"
export type Granularity = "hour" | "day" | "week" | "month"
export type QueryType = "timeseries" | "breakdown" | "summary"

/** Dimensions that can be grouped on. Anything else is treated as a properties.<key> path. */
export type KnownDimension = "event_name" | "event_category" | "source" | "session_id" | "user_id"

export const AGGREGATES: AggregateFn[] = ["count", "sum", "avg", "min", "max"]
export const GRANULARITIES: Granularity[] = ["hour", "day", "week", "month"]
export const QUERY_TYPES: QueryType[] = ["timeseries", "breakdown", "summary"]

/** A single event to ingest. */
export interface EventInput {
  event_name: string
  event_category?: string
  source?: string
  session_id?: string | null
  value?: number | null
  properties?: Record<string, unknown>
  occurred_at?: string
  /** Optional explicit actor; defaults to the authenticated user. */
  user_id?: string | null
}

/** Normalized query parameters shared by the engine functions. */
export interface AnalyticsQuery {
  type: QueryType
  event_name?: string | null
  event_category?: string | null
  aggregate?: AggregateFn
  granularity?: Granularity
  /** For breakdown queries: dimension column or properties.<key>. */
  dimension?: string
  /** Inclusive start / exclusive end. */
  start: string
  end: string
  /** Breakdown row cap (1–100). */
  limit?: number
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
  aggregate?: AggregateFn
  granularity?: Granularity
  dimension?: string
  /** Rolling window length in days used when the report is run. */
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
