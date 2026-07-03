import { createServiceClient } from "@/lib/supabase/service"
import { normalizeAggregate, normalizeGranularity } from "./engine"
import {
  QUERY_TYPES,
  type AnalyticsQuery,
  type AnalyticsReport,
  type ReportConfig,
} from "./types"

/**
 * Module #7: Saved analytics reports store.
 *
 * Reports persist a reusable query definition (config). All functions are
 * org-scoped via an already-validated organizationId; the service client is
 * used for writes, and every query filters by organization_id so a report
 * from another tenant can never be read or mutated.
 */

function rowToReport(r: Record<string, unknown>): AnalyticsReport {
  return {
    id: r.id as string,
    organization_id: r.organization_id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    config: (r.config as ReportConfig) ?? ({ type: "summary" } as ReportConfig),
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

/** Validate + normalize a report config, returning [config, error]. */
export function normalizeReportConfig(input: unknown): [ReportConfig | null, string | null] {
  if (!input || typeof input !== "object") return [null, "config must be an object"]
  const c = input as ReportConfig
  if (!QUERY_TYPES.includes(c.type)) {
    return [null, `config.type must be one of: ${QUERY_TYPES.join(", ")}`]
  }
  if (c.type === "breakdown" && !c.dimension) {
    return [null, "breakdown reports require config.dimension"]
  }
  const range = Number(c.range_days)
  const config: ReportConfig = {
    type: c.type,
    event_name: c.event_name ?? null,
    event_category: c.event_category ?? null,
    aggregate: normalizeAggregate(c.aggregate),
    granularity: normalizeGranularity(c.granularity),
    dimension: c.dimension,
    range_days: Number.isFinite(range) && range > 0 ? Math.min(range, 365) : 30,
    limit: c.limit != null ? Math.min(Math.max(Number(c.limit) || 10, 1), 100) : 10,
  }
  return [config, null]
}

/** Build a concrete, time-bounded query from a saved report config. */
export function reportToQuery(config: ReportConfig, now = new Date()): AnalyticsQuery {
  const end = now
  const start = new Date(end.getTime() - (config.range_days ?? 30) * 24 * 60 * 60 * 1000)
  return {
    type: config.type,
    event_name: config.event_name ?? null,
    event_category: config.event_category ?? null,
    aggregate: config.aggregate,
    granularity: config.granularity,
    dimension: config.dimension,
    limit: config.limit,
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export async function listReports(organizationId: string): Promise<AnalyticsReport[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("analytics_reports")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
  if (error) {
    console.log("[v0] listReports failed:", error.message)
    return []
  }
  return (data ?? []).map(rowToReport)
}

export async function getReport(
  organizationId: string,
  id: string,
): Promise<AnalyticsReport | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("analytics_reports")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getReport failed:", error.message)
    return null
  }
  return data ? rowToReport(data) : null
}

export async function createReport(
  organizationId: string,
  createdBy: string,
  input: { name: string; description?: string | null; config: ReportConfig },
): Promise<AnalyticsReport | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("analytics_reports")
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description ?? null,
      config: input.config,
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createReport failed:", error.message)
    return null
  }
  return rowToReport(data)
}

export async function updateReport(
  organizationId: string,
  id: string,
  patch: { name?: string; description?: string | null; config?: ReportConfig },
): Promise<AnalyticsReport | null> {
  const db = createServiceClient()
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) fields.name = patch.name
  if (patch.description !== undefined) fields.description = patch.description
  if (patch.config !== undefined) fields.config = patch.config

  const { data, error } = await db
    .from("analytics_reports")
    .update(fields)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] updateReport failed:", error.message)
    return null
  }
  return data ? rowToReport(data) : null
}

export async function deleteReport(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from("analytics_reports")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)
  if (error) {
    console.log("[v0] deleteReport failed:", error.message)
    return false
  }
  return true
}

/** Alias for listReports — reuses the same query logic. */
export async function getReports(
  organizationId: string,
  limit = 50,
  offset = 0,
): Promise<{ reports: AnalyticsReport[]; total: number }> {
  const db = createServiceClient()
  const { data, error, count } = await db
    .from("analytics_reports")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) {
    console.log("[v0] getReports failed:", error.message)
    return { reports: [], total: 0 }
  }
  return { reports: (data ?? []).map(rowToReport), total: count ?? 0 }
}

/** Execute a saved report's config against the analytics engine. */
export async function runSavedReport(
  organizationId: string,
  reportId: string,
): Promise<unknown> {
  const report = await getReport(organizationId, reportId)
  if (!report) throw new Error("report not found")
  const { runQuery } = await import("./engine.js")
  const cfg = report.config
  const now = new Date()
  const end = now.toISOString()
  const start = new Date(now.getTime() - (cfg.range_days ?? 30) * 86400000).toISOString()
  return runQuery(organizationId, {
    type: cfg.type,
    event_name: cfg.event_name,
    event_category: cfg.event_category,
    aggregate: cfg.aggregate,
    granularity: cfg.granularity,
    dimension: cfg.dimension,
    limit: cfg.limit,
    start,
    end,
  })
}
