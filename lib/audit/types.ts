/**
 * Module #10 – Audit Logging types.
 * Mirrors the public.audit_logs table columns exactly.
 */

export interface AuditLogEntry {
  id: string
  organization_id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  hash: string | null
  previous_hash: string | null
  created_at: string
}

export interface AuditLogFilters {
  action?: string
  userId?: string
  resourceType?: string
  resourceId?: string
  /** ISO date-time string – lower bound (inclusive) */
  since?: string
  /** ISO date-time string – upper bound (inclusive) */
  until?: string
}

export interface AuditLogListResult {
  entries: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface AuditLogStats {
  total: number
  by_action: Record<string, number>
  by_user: Record<string, number>
  by_day: Array<{ date: string; count: number }>
  period_days: number
  since: string
}

export interface AuditRetentionSettings {
  retentionDays: number
}
