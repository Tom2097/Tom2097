import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"
import {
  AGGREGATES,
  GRANULARITIES,
  type AggregateFn,
  type AnalyticsQuery,
  type AnalyticsSummary,
  type BreakdownRow,
  type EventInput,
  type Granularity,
  type TimeseriesPoint,
} from "./types"

export interface FunnelStep {
  step: number
  name: string
  event_name: string
  count: number
  conversion_rate: number
  drop_rate: number
}

export interface RetentionCohort {
  cohort_date: string
  period: number
  users: number
  retention: number
}

/**
 * Module #7: Analytics engine.
 *
 * Ingestion writes directly to `analytics_events`; aggregation delegates to
 * SECURITY DEFINER SQL functions (analytics_event_*), which are only callable
 * by the service role. Every function takes an already-validated
 * `organizationId` (resolved by withAuth) and scopes all I/O to it, preserving
 * the multi-tenant boundary.
 */

const MAX_BATCH = 500

export function normalizeAggregate(v: unknown): AggregateFn {
  return AGGREGATES.includes(v as AggregateFn) ? (v as AggregateFn) : "count"
}

export function normalizeGranularity(v: unknown): Granularity {
  return GRANULARITIES.includes(v as Granularity) ? (v as Granularity) : "day"
}

/** Validate a single event payload, returning an error string or null. */
export function validateEvent(e: unknown): string | null {
  if (!e || typeof e !== "object") return "event must be an object"
  const ev = e as EventInput
  if (!ev.event_name || typeof ev.event_name !== "string" || !ev.event_name.trim()) {
    return "event_name is required"
  }
  if (ev.event_name.length > 200) return "event_name too long (max 200)"
  if (ev.value != null && typeof ev.value !== "number") return "value must be a number"
  if (ev.properties != null && typeof ev.properties !== "object") {
    return "properties must be an object"
  }
  if (ev.occurred_at != null && Number.isNaN(Date.parse(ev.occurred_at))) {
    return "occurred_at must be an ISO date string"
  }
  return null
}

/**
 * Ingest one or more events for an organization. The actor user id is applied
 * to any event that does not specify its own user_id. Returns the count
 * inserted.
 */
export async function trackEvents(
  organizationId: string,
  actorUserId: string | null,
  events: EventInput[],
): Promise<{ inserted: number }> {
  if (events.length === 0) return { inserted: 0 }
  if (events.length > MAX_BATCH) {
    throw new Error(`too many events (max ${MAX_BATCH} per request)`)
  }

  const rows = events.map((e) => ({
    organization_id: organizationId,
    user_id: e.user_id ?? actorUserId,
    event_name: e.event_name.trim(),
    event_category: (e.event_category ?? "general").trim() || "general",
    source: (e.source ?? "app").trim() || "app",
    session_id: e.session_id ?? null,
    value: e.value ?? null,
    properties: e.properties ?? {},
    occurred_at: e.occurred_at ?? new Date().toISOString(),
  }))

  const db = createServiceClient()
  const { error } = await db.from("analytics_events").insert(rows)
  if (error) {
    logger.logError("[v0] trackEvents insert failed:", { error: error.message })
    throw new Error("failed to record events")
  }
  return { inserted: rows.length }
}

export async function queryTimeseries(
  organizationId: string,
  q: AnalyticsQuery,
): Promise<TimeseriesPoint[]> {
  const db = createServiceClient()
  const { data, error } = await db.rpc("analytics_event_timeseries", {
    p_org: organizationId,
    p_event: q.event_name ?? "",
    p_category: q.event_category ?? "",
    p_start: q.start,
    p_end: q.end,
    p_granularity: normalizeGranularity(q.granularity),
    p_agg: normalizeAggregate(q.aggregate),
  })
  if (error) {
    logger.logError("[v0] queryTimeseries failed:", { error: error.message })
    throw new Error("failed to run timeseries query")
  }
  return (data ?? []).map((r: { bucket: string; value: number | string }) => ({
    bucket: r.bucket,
    value: Number(r.value),
  }))
}

export async function queryBreakdown(
  organizationId: string,
  q: AnalyticsQuery,
): Promise<BreakdownRow[]> {
  const db = createServiceClient()
  const { data, error } = await db.rpc("analytics_event_breakdown", {
    p_org: organizationId,
    p_event: q.event_name ?? "",
    p_category: q.event_category ?? "",
    p_dimension: q.dimension ?? "event_name",
    p_start: q.start,
    p_end: q.end,
    p_agg: normalizeAggregate(q.aggregate),
    p_limit: q.limit ?? 10,
  })
  if (error) {
    logger.logError("[v0] queryBreakdown failed:", { error: error.message })
    throw new Error("failed to run breakdown query")
  }
  return (data ?? []).map((r: { label: string | null; value: number | string }) => ({
    label: r.label ?? "(none)",
    value: Number(r.value),
  }))
}

export async function querySummary(
  organizationId: string,
  start: string,
  end: string,
): Promise<AnalyticsSummary> {
  const db = createServiceClient()
  const { data, error } = await db.rpc("analytics_event_summary", {
    p_org: organizationId,
    p_start: start,
    p_end: end,
  })
  if (error) {
    logger.logError("[v0] querySummary failed:", { error: error.message })
    throw new Error("failed to run summary query")
  }
  const row = (Array.isArray(data) ? data[0] : data) ?? {}
  return {
    total_events: Number(row.total_events ?? 0),
    unique_users: Number(row.unique_users ?? 0),
    distinct_events: Number(row.distinct_events ?? 0),
    total_value: Number(row.total_value ?? 0),
  }
}

/** Run a funnel analysis: count users progressing through ordered event steps. */
export async function queryFunnel(
  organizationId: string,
  steps: { name: string; event_name: string }[],
  start: string,
  end: string,
): Promise<FunnelStep[]> {
  const db = createServiceClient()
  const result: FunnelStep[] = []

  for (let i = 0; i < steps.length; i++) {
    const { data, error } = await db.rpc("analytics_event_funnel_step", {
      p_org: organizationId,
      p_event: steps[i].event_name,
      p_step: i + 1,
      p_steps: steps.map((s) => s.event_name),
      p_start: start,
      p_end: end,
    })
    if (error) {
      logger.logError("[v0] queryFunnel failed at step", { step: i, error: error.message })
      break
    }
    const count = Number((data as Array<{ count: number }> | null)?.[0]?.count ?? 0)
    const previous = result[i - 1]?.count ?? 0
    result.push({
      step: i + 1,
      name: steps[i].name,
      event_name: steps[i].event_name,
      count,
      conversion_rate: previous > 0 ? Math.round((count / previous) * 100) / 100 : 100,
      drop_rate: previous > 0 ? Math.round(((previous - count) / previous) * 100) / 100 : 0,
    })
  }

  return result
}

/** Run a retention cohort analysis. */
export async function queryRetention(
  organizationId: string,
  eventName: string,
  start: string,
  end: string,
): Promise<RetentionCohort[]> {
  const db = createServiceClient()
  const { data, error } = await db.rpc("analytics_event_retention", {
    p_org: organizationId,
    p_event: eventName,
    p_start: start,
    p_end: end,
  })
  if (error) {
    logger.logError("[v0] queryRetention failed:", { error: error.message })
    return []
  }
  return ((data ?? []) as RetentionCohort[]).map((r) => ({
    ...r,
    retention: Number(r.retention),
    users: Number(r.users),
  }))
}

/** Dispatch a normalized query to the right engine function. */
export async function runQuery(organizationId: string, q: AnalyticsQuery) {
  switch (q.type) {
    case "timeseries":
      return { type: "timeseries" as const, points: await queryTimeseries(organizationId, q) }
    case "breakdown":
      return { type: "breakdown" as const, rows: await queryBreakdown(organizationId, q) }
    case "summary":
      return { type: "summary" as const, summary: await querySummary(organizationId, q.start, q.end) }
    default:
      throw new Error("invalid query type")
  }
}
