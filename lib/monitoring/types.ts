/**
 * Module #21: Monitoring & Reliability — shared types.
 *
 * Operational observability layered on top of existing modules:
 * - monitors: configurable health checks (http / heartbeat / tcp / internal)
 * - monitor_checks: time-series check results
 * - incidents: severity/status tracking with a timeline of incident_events
 *
 * The engine runs checks with the service-role client (manual org scoping) and
 * can be driven by a cron via the service-role-only get_due_monitors() helper.
 */

export const MONITOR_TYPES = ["http", "heartbeat", "tcp", "internal"] as const
export type MonitorType = (typeof MONITOR_TYPES)[number]

export const MONITOR_METHODS = ["GET", "HEAD", "POST"] as const
export type MonitorMethod = (typeof MONITOR_METHODS)[number]

export const CHECK_STATUSES = ["up", "down", "degraded"] as const
export type CheckStatus = (typeof CHECK_STATUSES)[number]

export const MONITOR_STATUSES = ["unknown", ...CHECK_STATUSES] as const
export type MonitorStatus = (typeof MONITOR_STATUSES)[number]

export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]

export const INCIDENT_STATUSES = ["open", "investigating", "identified", "monitoring", "resolved"] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const INCIDENT_SOURCES = ["manual", "auto"] as const
export type IncidentSource = (typeof INCIDENT_SOURCES)[number]

export interface Monitor {
  id: string
  organization_id: string
  name: string
  description: string | null
  type: MonitorType
  target: string
  method: MonitorMethod
  expected_status: number
  interval_seconds: number
  timeout_ms: number
  degraded_latency_ms: number
  is_enabled: boolean
  last_status: MonitorStatus
  last_latency_ms: number | null
  last_checked_at: string | null
  next_check_at: string
  consecutive_failures: number
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MonitorInput {
  name: string
  description?: string | null
  type?: MonitorType
  target?: string
  method?: MonitorMethod
  expected_status?: number
  interval_seconds?: number
  timeout_ms?: number
  degraded_latency_ms?: number
  is_enabled?: boolean
  metadata?: Record<string, unknown>
}

export interface MonitorCheck {
  id: string
  organization_id: string
  monitor_id: string
  status: CheckStatus
  latency_ms: number | null
  status_code: number | null
  error: string | null
  checked_at: string
}

/** Result of executing a single check (before persistence). */
export interface CheckResult {
  status: CheckStatus
  latency_ms: number | null
  status_code: number | null
  error: string | null
}

export interface Incident {
  id: string
  organization_id: string
  monitor_id: string | null
  title: string
  summary: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  source: IncidentSource
  started_at: string
  resolved_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface IncidentInput {
  title: string
  summary?: string | null
  severity?: IncidentSeverity
  monitor_id?: string | null
}

export interface IncidentUpdateInput {
  title?: string
  summary?: string | null
  severity?: IncidentSeverity
  status?: IncidentStatus
}

export interface IncidentEvent {
  id: string
  organization_id: string
  incident_id: string
  status: IncidentStatus | null
  message: string
  created_by: string | null
  created_at: string
}

export interface ListMonitorsOptions {
  limit?: number
  offset?: number
  enabledOnly?: boolean
  status?: MonitorStatus
}

export interface ListIncidentsOptions {
  limit?: number
  offset?: number
  status?: IncidentStatus
  openOnly?: boolean
}

/** Aggregate health snapshot for an organization. */
export interface SystemHealth {
  overall: MonitorStatus
  monitors: {
    total: number
    up: number
    down: number
    degraded: number
    unknown: number
  }
  open_incidents: number
  checked_at: string
}
