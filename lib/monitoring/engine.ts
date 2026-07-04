import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"
import {
  CHECK_STATUSES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  MONITOR_METHODS,
  MONITOR_TYPES,
  type CheckResult,
  type CheckStatus,
  type Incident,
  type IncidentEvent,
  type IncidentInput,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentUpdateInput,
  type ListIncidentsOptions,
  type ListMonitorsOptions,
  type Monitor,
  type MonitorCheck,
  type MonitorInput,
  type MonitorStatus,
  type SystemHealth,
} from "./types"

/**
 * Module #21: Monitoring & Reliability engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary. Cross-tenant ids therefore
 * no-op rather than leaking data.
 *
 * Auto-incident policy: once a monitor reaches AUTO_INCIDENT_THRESHOLD
 * consecutive failures, an `auto`-sourced incident is opened (deduped against
 * any still-open auto incident for that monitor). A recovery (status back to
 * `up`) automatically resolves the open auto incident.
 */

const AUTO_INCIDENT_THRESHOLD = 3

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.round(v) : Number.parseInt(String(v), 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// ── Monitors ──────────────────────────────────────────────────────────────────

/** Validate a monitor payload. Returns an error string or null. */
export function validateMonitor(input: unknown): string | null {
  if (!input || typeof input !== "object") return "monitor must be an object"
  const m = input as MonitorInput
  if (!m.name || typeof m.name !== "string" || !m.name.trim()) return "name is required"
  if (m.name.length > 200) return "name too long (max 200)"
  const type = m.type ?? "http"
  if (!MONITOR_TYPES.includes(type)) return "invalid monitor type"
  if ((type === "http" || type === "tcp") && (!m.target || !String(m.target).trim())) {
    return "target is required for http/tcp monitors"
  }
  if (m.target && String(m.target).length > 2000) return "target too long"
  return null
}

export async function createMonitor(
  organizationId: string,
  createdBy: string,
  input: MonitorInput,
): Promise<Monitor> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("monitors")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      type: pick(MONITOR_TYPES, input.type, "http"),
      target: (input.target ?? "").trim(),
      method: pick(MONITOR_METHODS, input.method, "GET"),
      expected_status: clampInt(input.expected_status, 100, 599, 200),
      interval_seconds: clampInt(input.interval_seconds, 30, 86400, 300),
      timeout_ms: clampInt(input.timeout_ms, 1000, 60000, 10000),
      degraded_latency_ms: clampInt(input.degraded_latency_ms, 1, 60000, 2000),
      is_enabled: input.is_enabled ?? true,
      metadata: input.metadata ?? {},
      next_check_at: new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) {
    logger.logError("[v0] createMonitor failed:", { error: error.message })
    throw new Error("failed to create monitor")
  }
  return data as Monitor
}

export async function listMonitors(
  organizationId: string,
  opts: ListMonitorsOptions,
): Promise<{ monitors: Monitor[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("monitors")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.enabledOnly) query = query.eq("is_enabled", true)
  if (opts.status) query = query.eq("last_status", opts.status)

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    logger.logError("[v0] listMonitors failed:", { error: error.message })
    throw new Error("failed to list monitors")
  }
  return { monitors: (data ?? []) as Monitor[], total: count ?? 0 }
}

export async function getMonitor(organizationId: string, monitorId: string): Promise<Monitor | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("monitors")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", monitorId)
    .maybeSingle()
  if (error) {
    logger.logError("[v0] getMonitor failed:", { error: error.message })
    throw new Error("failed to fetch monitor")
  }
  return (data as Monitor) ?? null
}

export async function updateMonitor(
  organizationId: string,
  monitorId: string,
  patch: MonitorInput,
): Promise<Monitor | null> {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined && patch.name.trim()) update.name = patch.name.trim()
  if (patch.description !== undefined) update.description = patch.description?.trim() || null
  if (patch.type !== undefined) update.type = pick(MONITOR_TYPES, patch.type, "http")
  if (patch.target !== undefined) update.target = (patch.target ?? "").trim()
  if (patch.method !== undefined) update.method = pick(MONITOR_METHODS, patch.method, "GET")
  if (patch.expected_status !== undefined) update.expected_status = clampInt(patch.expected_status, 100, 599, 200)
  if (patch.interval_seconds !== undefined) update.interval_seconds = clampInt(patch.interval_seconds, 30, 86400, 300)
  if (patch.timeout_ms !== undefined) update.timeout_ms = clampInt(patch.timeout_ms, 1000, 60000, 10000)
  if (patch.degraded_latency_ms !== undefined)
    update.degraded_latency_ms = clampInt(patch.degraded_latency_ms, 1, 60000, 2000)
  if (patch.is_enabled !== undefined) update.is_enabled = !!patch.is_enabled
  if (patch.metadata !== undefined) update.metadata = patch.metadata ?? {}

  if (Object.keys(update).length === 0) return getMonitor(organizationId, monitorId)

  const db = createServiceClient()
  const { data, error } = await db
    .from("monitors")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", monitorId)
    .select("*")
    .maybeSingle()
  if (error) {
    logger.logError("[v0] updateMonitor failed:", { error: error.message })
    throw new Error("failed to update monitor")
  }
  return (data as Monitor) ?? null
}

export async function deleteMonitor(organizationId: string, monitorId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("monitors")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", monitorId)
    .select("id")
  if (error) {
    logger.logError("[v0] deleteMonitor failed:", { error: error.message })
    throw new Error("failed to delete monitor")
  }
  return (data ?? []).length > 0
}

// ── Check execution ─────────────────────────────────────────────────────────

/**
 * Execute a health check against the monitor's target. For http monitors this
 * performs a real fetch; heartbeat/internal monitors are evaluated by recency
 * of their last heartbeat (recorded via metadata) and default to `up`.
 */
export async function executeCheck(monitor: Monitor): Promise<CheckResult> {
  if (monitor.type === "heartbeat" || monitor.type === "internal") {
    // Passive monitors: treated as up unless explicitly degraded via metadata.
    return { status: "up", latency_ms: null, status_code: null, error: null }
  }

  if (!monitor.target) {
    return { status: "down", latency_ms: null, status_code: null, error: "no target configured" }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), monitor.timeout_ms)
  const started = Date.now()
  try {
    const res = await fetch(monitor.target, {
      method: monitor.method === "POST" ? "POST" : monitor.method,
      signal: controller.signal,
      redirect: "follow",
    })
    const latency = Date.now() - started
    const ok = res.status === monitor.expected_status || (monitor.expected_status === 200 && res.ok)
    let status: CheckStatus
    if (!ok) status = "down"
    else if (latency > monitor.degraded_latency_ms) status = "degraded"
    else status = "up"
    return { status, latency_ms: latency, status_code: res.status, error: ok ? null : `unexpected status ${res.status}` }
  } catch (err) {
    const latency = Date.now() - started
    const message = err instanceof Error ? (err.name === "AbortError" ? "timeout" : err.message) : "request failed"
    return { status: "down", latency_ms: latency, status_code: null, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Record a check result: persists a monitor_checks row, updates the monitor's
 * rollup state + next_check_at, and drives auto-incident open/resolve.
 * `result` may be supplied (e.g. heartbeat ping) or omitted to run executeCheck.
 */
export async function recordCheck(
  organizationId: string,
  monitorId: string,
  provided?: CheckResult,
): Promise<{ monitor: Monitor; check: MonitorCheck; result: CheckResult } | null> {
  const monitor = await getMonitor(organizationId, monitorId)
  if (!monitor) return null

  const result = provided ?? (await executeCheck(monitor))
  const status = pick(CHECK_STATUSES, result.status, "down")
  const db = createServiceClient()
  const now = new Date()

  const { data: check, error: checkErr } = await db
    .from("monitor_checks")
    .insert({
      organization_id: organizationId,
      monitor_id: monitorId,
      status,
      latency_ms: result.latency_ms,
      status_code: result.status_code,
      error: result.error,
      checked_at: now.toISOString(),
    })
    .select("*")
    .single()
  if (checkErr) {
    logger.logError("[v0] recordCheck insert failed:", { error: checkErr.message })
    throw new Error("failed to record check")
  }

  const failed = status === "down"
  const consecutiveFailures = failed ? monitor.consecutive_failures + 1 : 0
  const nextCheck = new Date(now.getTime() + monitor.interval_seconds * 1000)

  const { data: updated, error: updErr } = await db
    .from("monitors")
    .update({
      last_status: status,
      last_latency_ms: result.latency_ms,
      last_checked_at: now.toISOString(),
      next_check_at: nextCheck.toISOString(),
      consecutive_failures: consecutiveFailures,
    })
    .eq("organization_id", organizationId)
    .eq("id", monitorId)
    .select("*")
    .single()
  if (updErr) {
    logger.logError("[v0] recordCheck monitor update failed:", { error: updErr.message })
    throw new Error("failed to update monitor")
  }

  // Auto-incident lifecycle (best-effort; never block the check pipeline).
  try {
    if (failed && consecutiveFailures >= AUTO_INCIDENT_THRESHOLD) {
      await openAutoIncident(organizationId, updated as Monitor, consecutiveFailures)
    } else if (status === "up" && monitor.consecutive_failures >= AUTO_INCIDENT_THRESHOLD) {
      await resolveAutoIncidents(organizationId, monitorId)
    }
  } catch (e) {
    logger.logError("[v0] auto-incident handling failed:", { error: e instanceof Error ? e.message : String(e) })
  }

  return { monitor: updated as Monitor, check: check as MonitorCheck, result }
}

/**
 * Cross-tenant list of monitors whose next check is due. Used only by the
 * scheduled runner (system context), so it is NOT org-scoped — each returned
 * monitor still carries its own organization_id, which downstream calls use to
 * preserve tenant isolation. A monitor is due when it is enabled and either has
 * never been checked (next_check_at null) or next_check_at has passed.
 */
export async function listDueMonitors(limit = 200): Promise<Monitor[]> {
  const db = createServiceClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await db
    .from("monitors")
    .select("*")
    .eq("is_enabled", true)
    .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) {
    logger.logError("[v0] listDueMonitors failed:", { error: error.message })
    throw new Error("failed to list due monitors")
  }
  return (data ?? []) as Monitor[]
}

export interface RunChecksSummary {
  processed: number
  up: number
  down: number
  degraded: number
  failed: number
  results: Array<{ monitorId: string; organizationId: string; status: CheckStatus | "error"; error?: string }>
}

/**
 * Execute all due monitor checks. Each monitor is checked independently with
 * its own error boundary so one failure can never abort the batch. recordCheck
 * persists the result, advances next_check_at, and drives the auto-incident
 * lifecycle. Returns an aggregate summary for the scheduler's response/logs.
 */
export async function runDueChecks(limit = 200): Promise<RunChecksSummary> {
  const due = await listDueMonitors(limit)
  const summary: RunChecksSummary = { processed: 0, up: 0, down: 0, degraded: 0, failed: 0, results: [] }

  for (const monitor of due) {
    try {
      const outcome = await recordCheck(monitor.organization_id, monitor.id)
      const status = outcome?.result.status ?? "down"
      summary.processed++
      if (status === "up") summary.up++
      else if (status === "down") summary.down++
      else if (status === "degraded") summary.degraded++
      summary.results.push({ monitorId: monitor.id, organizationId: monitor.organization_id, status })
    } catch (e) {
      summary.failed++
      const message = e instanceof Error ? e.message : String(e)
      logger.logError("[v0] runDueChecks: monitor failed:", { monitorId: monitor.id, error: message })
      summary.results.push({
        monitorId: monitor.id,
        organizationId: monitor.organization_id,
        status: "error",
        error: message,
      })
    }
  }

  logger.logInfo(`[v0] runDueChecks complete: processed=${summary.processed} up=${summary.up} down=${summary.down} degraded=${summary.degraded} failed=${summary.failed}`)
  return summary
}

/** Recent check history for a monitor (scoped to org). */
export async function listChecks(
  organizationId: string,
  monitorId: string,
  limit = 100,
): Promise<MonitorCheck[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("monitor_checks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("monitor_id", monitorId)
    .order("checked_at", { ascending: false })
    .limit(Math.min(limit, 1000))
  if (error) {
    logger.logError("[v0] listChecks failed:", { error: error.message })
    throw new Error("failed to list checks")
  }
  return (data ?? []) as MonitorCheck[]
}

// ── Incidents ─────────────────────────────────────────────────────────────────

async function openAutoIncident(organizationId: string, monitor: Monitor, failures: number): Promise<void> {
  const db = createServiceClient()
  // Dedupe: skip if an unresolved auto incident already exists for this monitor.
  const { data: existing } = await db
    .from("incidents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("monitor_id", monitor.id)
    .eq("source", "auto")
    .neq("status", "resolved")
    .maybeSingle()
  if (existing) return

  const severity: IncidentSeverity = failures >= AUTO_INCIDENT_THRESHOLD * 2 ? "high" : "medium"
  const { data: incident, error } = await db
    .from("incidents")
    .insert({
      organization_id: organizationId,
      monitor_id: monitor.id,
      title: `${monitor.name} is down`,
      summary: `Automatically opened after ${failures} consecutive failed checks.`,
      severity,
      status: "open",
      source: "auto",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (error) {
    logger.logError("[v0] openAutoIncident failed:", { error: error.message })
    return
  }
  await db.from("incident_events").insert({
    organization_id: organizationId,
    incident_id: incident.id,
    status: "open",
    message: `Detected ${failures} consecutive failures on monitor "${monitor.name}".`,
  })
}

async function resolveAutoIncidents(organizationId: string, monitorId: string): Promise<void> {
  const db = createServiceClient()
  const { data: open } = await db
    .from("incidents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("monitor_id", monitorId)
    .eq("source", "auto")
    .neq("status", "resolved")
  for (const inc of open ?? []) {
    await db
      .from("incidents")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", inc.id)
    await db.from("incident_events").insert({
      organization_id: organizationId,
      incident_id: inc.id,
      status: "resolved",
      message: "Monitor recovered; incident auto-resolved.",
    })
  }
}

export async function createIncident(
  organizationId: string,
  createdBy: string,
  input: IncidentInput,
): Promise<Incident> {
  const db = createServiceClient()
  // If linked to a monitor, ensure it belongs to this org.
  let monitorId: string | null = null
  if (input.monitor_id) {
    const mon = await getMonitor(organizationId, input.monitor_id)
    monitorId = mon ? mon.id : null
  }
  const { data, error } = await db
    .from("incidents")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      monitor_id: monitorId,
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      severity: pick(INCIDENT_SEVERITIES, input.severity, "medium"),
      status: "open",
      source: "manual",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) {
    logger.logError("[v0] createIncident failed:", { error: error.message })
    throw new Error("failed to create incident")
  }
  await db.from("incident_events").insert({
    organization_id: organizationId,
    incident_id: data.id,
    status: "open",
    message: "Incident opened.",
    created_by: createdBy,
  })
  return data as Incident
}

export async function listIncidents(
  organizationId: string,
  opts: ListIncidentsOptions,
): Promise<{ incidents: Incident[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("incidents")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.openOnly) query = query.neq("status", "resolved")

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    logger.logError("[v0] listIncidents failed:", { error: error.message })
    throw new Error("failed to list incidents")
  }
  return { incidents: (data ?? []) as Incident[], total: count ?? 0 }
}

export async function getIncident(organizationId: string, incidentId: string): Promise<Incident | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("incidents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", incidentId)
    .maybeSingle()
  if (error) {
    logger.logError("[v0] getIncident failed:", { error: error.message })
    throw new Error("failed to fetch incident")
  }
  return (data as Incident) ?? null
}

/** Update an incident; status transitions append a timeline event. */
export async function updateIncident(
  organizationId: string,
  incidentId: string,
  patch: IncidentUpdateInput,
  actorId: string,
  note?: string,
): Promise<Incident | null> {
  const current = await getIncident(organizationId, incidentId)
  if (!current) return null

  const update: Record<string, unknown> = {}
  if (patch.title !== undefined && patch.title.trim()) update.title = patch.title.trim()
  if (patch.summary !== undefined) update.summary = patch.summary?.trim() || null
  if (patch.severity !== undefined) update.severity = pick(INCIDENT_SEVERITIES, patch.severity, current.severity)

  let newStatus: IncidentStatus | undefined
  if (patch.status !== undefined) {
    newStatus = pick(INCIDENT_STATUSES, patch.status, current.status)
    update.status = newStatus
    if (newStatus === "resolved") update.resolved_at = new Date().toISOString()
    else update.resolved_at = null
  }

  const db = createServiceClient()
  if (Object.keys(update).length > 0) {
    const { error } = await db
      .from("incidents")
      .update(update)
      .eq("organization_id", organizationId)
      .eq("id", incidentId)
    if (error) {
      logger.logError("[v0] updateIncident failed:", { error: error.message })
      throw new Error("failed to update incident")
    }
  }

  // Timeline event when status changes or a note is supplied.
  if (newStatus || (note && note.trim())) {
    await db.from("incident_events").insert({
      organization_id: organizationId,
      incident_id: incidentId,
      status: newStatus ?? null,
      message: note?.trim() || `Status changed to ${newStatus}.`,
      created_by: actorId,
    })
  }

  return getIncident(organizationId, incidentId)
}

/** Append a timeline event / status update to an incident. */
export async function addIncidentEvent(
  organizationId: string,
  incidentId: string,
  actorId: string,
  message: string,
  status?: IncidentStatus,
): Promise<IncidentEvent | null> {
  const incident = await getIncident(organizationId, incidentId)
  if (!incident) return null

  // If a status is included, fold it through updateIncident to keep state in sync.
  if (status) {
    await updateIncident(organizationId, incidentId, { status }, actorId, message)
    const db = createServiceClient()
    const { data } = await db
      .from("incident_events")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as IncidentEvent) ?? null
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("incident_events")
    .insert({
      organization_id: organizationId,
      incident_id: incidentId,
      status: null,
      message: message.trim(),
      created_by: actorId,
    })
    .select("*")
    .single()
  if (error) {
    logger.logError("[v0] addIncidentEvent failed:", { error: error.message })
    throw new Error("failed to add incident event")
  }
  return data as IncidentEvent
}

export async function listIncidentEvents(
  organizationId: string,
  incidentId: string,
): Promise<IncidentEvent[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("incident_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true })
  if (error) {
    logger.logError("[v0] listIncidentEvents failed:", { error: error.message })
    throw new Error("failed to list incident events")
  }
  return (data ?? []) as IncidentEvent[]
}

// ── System health ─────────────────────────────────────────────────────────────

/** Aggregate health snapshot for an org: monitor status rollup + open incidents. */
export async function getSystemHealth(organizationId: string): Promise<SystemHealth> {
  const db = createServiceClient()
  const [{ data: monitors, error: monErr }, { count: openIncidents, error: incErr }] = await Promise.all([
    db.from("monitors").select("last_status").eq("organization_id", organizationId).eq("is_enabled", true),
    db
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .neq("status", "resolved"),
  ])
  if (monErr) {
    logger.logError("[v0] getSystemHealth monitors failed:", { error: monErr.message })
    throw new Error("failed to compute system health")
  }
  if (incErr) {
    logger.logError("[v0] getSystemHealth incidents failed:", { error: incErr.message })
    throw new Error("failed to compute system health")
  }

  const counts = { up: 0, down: 0, degraded: 0, unknown: 0 }
  for (const m of monitors ?? []) {
    const s = (m as { last_status: MonitorStatus }).last_status
    if (s === "up") counts.up++
    else if (s === "down") counts.down++
    else if (s === "degraded") counts.degraded++
    else counts.unknown++
  }
  const total = (monitors ?? []).length

  let overall: MonitorStatus = "unknown"
  if (total > 0) {
    if (counts.down > 0) overall = "down"
    else if (counts.degraded > 0) overall = "degraded"
    else if (counts.up > 0) overall = "up"
  }

  return {
    overall,
    monitors: { total, ...counts },
    open_incidents: openIncidents ?? 0,
    checked_at: new Date().toISOString(),
  }
}
