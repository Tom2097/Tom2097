import { createServiceClient } from "@/lib/supabase/service"
import { runQuery, querySummary } from "@/lib/analytics/engine"
import type { AnalyticsQuery } from "@/lib/analytics/types"
import { logger } from "@/lib/logging"
import {
  REPORT_SOURCES,
  SCHEDULE_FREQUENCIES,
  type ListReportsOptions,
  type ReportDefinition,
  type ReportDefinitionInput,
  type ReportRun,
  type ReportSchedule,
  type ReportScheduleInput,
  type ReportSection,
  type ReportSectionResult,
  type ScheduleFrequency,
} from "./types"

/**
 * Module #13: Reporting engine.
 *
 * Higher-level than the Module #7 analytics engine: it composes multi-source
 * report definitions, schedules them, and generates immutable run snapshots.
 * Analytics sections DELEGATE to lib/analytics/engine (no query logic is
 * re-implemented here). Every function takes an already-validated
 * `organizationId` (resolved by withAuth) and scopes all I/O to it, preserving
 * the multi-tenant boundary; cross-tenant ids no-op rather than leak data.
 */

const MAX_SECTIONS = 25

function isSource(v: unknown): v is ReportSection["source"] {
  return REPORT_SOURCES.includes(v as ReportSection["source"])
}

/** Validate and normalize the sections array. Returns [normalized, error]. */
function normalizeSections(input: unknown): [ReportSection[], string | null] {
  if (input == null) return [[], null]
  if (!Array.isArray(input)) return [[], "sections must be an array"]
  if (input.length > MAX_SECTIONS) return [[], `too many sections (max ${MAX_SECTIONS})`]
  const out: ReportSection[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return [[], "each section must be an object"]
    const s = raw as Partial<ReportSection>
    if (!s.key || typeof s.key !== "string") return [[], "section.key is required"]
    if (seen.has(s.key)) return [[], `duplicate section key: ${s.key}`]
    seen.add(s.key)
    if (!isSource(s.source)) return [[], `invalid section.source: ${String(s.source)}`]
    out.push({
      key: s.key,
      title: typeof s.title === "string" && s.title.trim() ? s.title : s.key,
      source: s.source,
      params: s.params && typeof s.params === "object" ? (s.params as Record<string, unknown>) : {},
    })
  }
  return [out, null]
}

/** Validate a definition payload. Returns an error string or null. */
export function validateDefinition(input: unknown): string | null {
  if (!input || typeof input !== "object") return "report must be an object"
  const d = input as ReportDefinitionInput
  if (!d.name || typeof d.name !== "string" || !d.name.trim()) return "name is required"
  if (d.name.length > 200) return "name too long (max 200)"
  if (d.range_days != null && (typeof d.range_days !== "number" || d.range_days < 1 || d.range_days > 365)) {
    return "range_days must be between 1 and 365"
  }
  const [, err] = normalizeSections(d.sections)
  return err
}

// ── Definition CRUD ─────────────────────────────────────────────────────────

export async function createDefinition(
  organizationId: string,
  createdBy: string | null,
  input: ReportDefinitionInput,
): Promise<ReportDefinition> {
  const [sections] = normalizeSections(input.sections)
  const db = createServiceClient()
  const { data, error } = await db
    .from("report_definitions")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      description: input.description ?? null,
      sections,
      range_days: input.range_days ?? 30,
      is_active: input.is_active ?? true,
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error) {
    logger.logError("[v0] createDefinition failed:", { error: error.message })
    throw new Error("failed to create report definition")
  }
  return data as ReportDefinition
}

export async function listDefinitions(
  organizationId: string,
  opts: ListReportsOptions = {},
): Promise<{ items: ReportDefinition[]; total: number }> {
  const db = createServiceClient()
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const offset = Math.max(opts.offset ?? 0, 0)
  let q = db
    .from("report_definitions")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (opts.activeOnly) q = q.eq("is_active", true)
  const { data, error, count } = await q
  if (error) {
    logger.logError("[v0] listDefinitions failed:", { error: error.message })
    throw new Error("failed to list report definitions")
  }
  return { items: (data ?? []) as ReportDefinition[], total: count ?? 0 }
}

export async function getDefinition(
  organizationId: string,
  id: string,
): Promise<ReportDefinition | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("report_definitions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    logger.logError("[v0] getDefinition failed:", { error: error.message })
    throw new Error("failed to load report definition")
  }
  return (data as ReportDefinition) ?? null
}

export async function updateDefinition(
  organizationId: string,
  id: string,
  input: Partial<ReportDefinitionInput>,
): Promise<ReportDefinition | null> {
  const patch: Record<string, unknown> = {}
  if (input.name != null) patch.name = input.name.trim()
  if (input.description !== undefined) patch.description = input.description
  if (input.range_days != null) patch.range_days = input.range_days
  if (input.is_active != null) patch.is_active = input.is_active
  if (input.sections !== undefined) {
    const [sections, err] = normalizeSections(input.sections)
    if (err) throw new Error(err)
    patch.sections = sections
  }
  if (Object.keys(patch).length === 0) return getDefinition(organizationId, id)

  const db = createServiceClient()
  const { data, error } = await db
    .from("report_definitions")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    logger.logError("[v0] updateDefinition failed:", { error: error.message })
    throw new Error("failed to update report definition")
  }
  return (data as ReportDefinition) ?? null
}

export async function deleteDefinition(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { error, count } = await db
    .from("report_definitions")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("id", id)
  if (error) {
    logger.logError("[v0] deleteDefinition failed:", { error: error.message })
    throw new Error("failed to delete report definition")
  }
  return (count ?? 0) > 0
}

// ── Scheduling ──────────────────────────────────────────────────────────────

export function isFrequency(v: unknown): v is ScheduleFrequency {
  return SCHEDULE_FREQUENCIES.includes(v as ScheduleFrequency)
}

/** Compute the next UTC run timestamp for a frequency at a given hour. */
export function computeNextRun(frequency: ScheduleFrequency, hourUtc: number, from = new Date()): Date {
  const next = new Date(from)
  next.setUTCMinutes(0, 0, 0)
  next.setUTCHours(hourUtc)
  if (next <= from) {
    if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1)
    else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7)
    else next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next
}

/** Create or update the schedule for a definition (one per definition). */
export async function upsertSchedule(
  organizationId: string,
  definitionId: string,
  input: ReportScheduleInput,
): Promise<ReportSchedule | null> {
  // Ensure the definition belongs to this org before scheduling.
  const def = await getDefinition(organizationId, definitionId)
  if (!def) return null
  if (!isFrequency(input.frequency)) throw new Error("invalid frequency")
  const hourUtc = Math.min(Math.max(input.hour_utc ?? 6, 0), 23)
  const nextRun = computeNextRun(input.frequency, hourUtc)

  const db = createServiceClient()
  const { data, error } = await db
    .from("report_schedules")
    .upsert(
      {
        organization_id: organizationId,
        definition_id: definitionId,
        frequency: input.frequency,
        hour_utc: hourUtc,
        is_enabled: input.is_enabled ?? true,
        next_run_at: nextRun.toISOString(),
        recipients: input.recipients ?? [],
      },
      { onConflict: "definition_id" },
    )
    .select("*")
    .single()
  if (error) {
    logger.logError("[v0] upsertSchedule failed:", { error: error.message })
    throw new Error("failed to save schedule")
  }
  return data as ReportSchedule
}

export async function getSchedule(
  organizationId: string,
  definitionId: string,
): Promise<ReportSchedule | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("report_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("definition_id", definitionId)
    .maybeSingle()
  if (error) {
    logger.logError("[v0] getSchedule failed:", { error: error.message })
    throw new Error("failed to load schedule")
  }
  return (data as ReportSchedule) ?? null
}

// ── Section data sources ──────────────────────────────────────────────────────

async function buildAuditSection(
  organizationId: string,
  startIso: string,
  endIso: string,
): Promise<unknown> {
  const db = createServiceClient()
  const { count } = await db
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
  const { data } = await db
    .from("audit_logs")
    .select("action")
    .eq("organization_id", organizationId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .limit(5000)
  const byAction: Record<string, number> = {}
  for (const row of (data ?? []) as { action: string }[]) {
    byAction[row.action] = (byAction[row.action] ?? 0) + 1
  }
  return { total: count ?? 0, by_action: byAction }
}

async function buildFeedbackSection(
  organizationId: string,
  startIso: string,
  endIso: string,
): Promise<unknown> {
  const db = createServiceClient()
  const { data, count } = await db
    .from("feedback")
    .select("status,type,rating", { count: "exact" })
    .eq("organization_id", organizationId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .limit(5000)
  const rows = (data ?? []) as { status: string; type: string; rating: number | null }[]
  const byStatus: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let ratingSum = 0
  let ratingCount = 0
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    byType[r.type] = (byType[r.type] ?? 0) + 1
    if (typeof r.rating === "number") {
      ratingSum += r.rating
      ratingCount += 1
    }
  }
  return {
    total: count ?? 0,
    by_status: byStatus,
    by_type: byType,
    avg_rating: ratingCount ? Number((ratingSum / ratingCount).toFixed(2)) : null,
  }
}

async function buildDocumentsSection(
  organizationId: string,
  startIso: string,
  endIso: string,
): Promise<unknown> {
  const db = createServiceClient()
  const { data, count } = await db
    .from("documents")
    .select("status,size_bytes", { count: "exact" })
    .eq("organization_id", organizationId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .limit(5000)
  const rows = (data ?? []) as { status: string; size_bytes: number }[]
  const byStatus: Record<string, number> = {}
  let totalBytes = 0
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    totalBytes += Number(r.size_bytes ?? 0)
  }
  return { total: count ?? 0, by_status: byStatus, total_bytes: totalBytes }
}

async function buildAnalyticsSection(
  organizationId: string,
  params: Record<string, unknown>,
  startIso: string,
  endIso: string,
): Promise<unknown> {
  const type = (params.type as string) ?? "summary"
  if (type === "summary") {
    return querySummary(organizationId, startIso, endIso)
  }
  const query = { ...params, type, start: startIso, end: endIso } as unknown as AnalyticsQuery
  return runQuery(organizationId, query)
}

async function buildSection(
  organizationId: string,
  section: ReportSection,
  startIso: string,
  endIso: string,
): Promise<ReportSectionResult> {
  try {
    let data: unknown
    switch (section.source) {
      case "analytics":
        data = await buildAnalyticsSection(organizationId, section.params ?? {}, startIso, endIso)
        break
      case "audit":
        data = await buildAuditSection(organizationId, startIso, endIso)
        break
      case "feedback":
        data = await buildFeedbackSection(organizationId, startIso, endIso)
        break
      case "documents":
        data = await buildDocumentsSection(organizationId, startIso, endIso)
        break
      default:
        return { key: section.key, title: section.title, source: section.source, data: null, error: "unknown source" }
    }
    return { key: section.key, title: section.title, source: section.source, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "section failed"
    logger.logError("[v0] buildSection failed:", { section: section.key, error: msg })
    return { key: section.key, title: section.title, source: section.source, data: null, error: msg }
  }
}

// ── Run generation ────────────────────────────────────────────────────────────

/**
 * Generate a report run for a definition. Creates a run row, executes every
 * section, and persists the snapshot. Returns the completed (or failed) run.
 */
export async function generateRun(
  organizationId: string,
  definitionId: string,
  generatedBy: string | null,
  trigger: "manual" | "scheduled" = "manual",
): Promise<ReportRun | null> {
  const def = await getDefinition(organizationId, definitionId)
  if (!def) return null

  const end = new Date()
  const start = new Date(end.getTime() - def.range_days * 24 * 60 * 60 * 1000)
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const db = createServiceClient()
  const { data: runRow, error: insErr } = await db
    .from("report_runs")
    .insert({
      organization_id: organizationId,
      definition_id: definitionId,
      status: "running",
      trigger,
      range_start: startIso,
      range_end: endIso,
      generated_by: generatedBy,
    })
    .select("*")
    .single()
  if (insErr || !runRow) {
    logger.logError("[v0] generateRun: failed to create run:", { error: insErr?.message })
    throw new Error("failed to start report run")
  }

  const sections = def.sections ?? []
  const results: ReportSectionResult[] = []
  for (const section of sections) {
    results.push(await buildSection(organizationId, section, startIso, endIso))
  }
  const anyError = results.some((r) => r.error)

  const { data: finished, error: updErr } = await db
    .from("report_runs")
    .update({
      status: anyError && results.every((r) => r.error) ? "failed" : "completed" as const,
      result: { sections: results, generated_at: new Date().toISOString() },
      error: anyError ? "one or more sections failed" : null,
      completed_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", runRow.id)
    .select("*")
    .single()
  if (updErr) {
    logger.logError("[v0] generateRun: failed to finalize run:", { error: updErr.message })
    throw new Error("failed to finalize report run")
  }
  return finished as ReportRun
}

export async function listRuns(
  organizationId: string,
  definitionId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: ReportRun[]; total: number }> {
  const db = createServiceClient()
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)
  const { data, error, count } = await db
    .from("report_runs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("definition_id", definitionId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) {
    logger.logError("[v0] listRuns failed:", { error: error.message })
    throw new Error("failed to list report runs")
  }
  return { items: (data ?? []) as ReportRun[], total: count ?? 0 }
}

export async function getRun(organizationId: string, runId: string): Promise<ReportRun | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("report_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .maybeSingle()
  if (error) {
    logger.logError("[v0] getRun failed:", { error: error.message })
    throw new Error("failed to load report run")
  }
  return (data as ReportRun) ?? null
}
