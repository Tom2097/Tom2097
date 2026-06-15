/**
 * Module #15: Data Retention — types.
 *
 * A general, cross-resource retention policy registry + purge engine. This
 * COMPLEMENTS Module #10 (audit-specific retention): a policy whose
 * resource_type is "audit_logs" delegates its purge to Module #10's existing
 * `runRetentionCleanup`, so that behaviour is reused rather than redesigned.
 */

export const RETENTION_RESOURCE_TYPES = [
  "audit_logs",
  "monitor_checks",
  "integration_deliveries",
  "notifications",
] as const
export type RetentionResourceType = (typeof RETENTION_RESOURCE_TYPES)[number]

export const RUN_STATUSES = ["success", "failed", "skipped"] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const RUN_TRIGGERS = ["manual", "scheduled"] as const
export type RunTrigger = (typeof RUN_TRIGGERS)[number]

export const MIN_RETENTION_DAYS = 1
export const MAX_RETENTION_DAYS = 3650
export const MIN_INTERVAL_HOURS = 1
export const MAX_INTERVAL_HOURS = 8760

/**
 * Resource types whose purge is delegated to another module rather than the
 * DB-side `data_retention_purge` whitelist. Keeps Module #10 authoritative for
 * audit logs.
 */
export const DELEGATED_RESOURCE_TYPES: readonly RetentionResourceType[] = ["audit_logs"]

export interface RetentionPolicy {
  id: string
  organization_id: string
  resource_type: RetentionResourceType
  retention_days: number
  is_enabled: boolean
  schedule_interval_hours: number
  description: string | null
  last_run_at: string | null
  last_deleted_count: number | null
  next_run_at: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RetentionRun {
  id: string
  organization_id: string
  policy_id: string | null
  resource_type: string
  retention_days: number
  status: RunStatus
  deleted_count: number
  trigger: RunTrigger
  error: string | null
  triggered_by: string | null
  created_at: string
}

export interface RetentionPolicyInput {
  resource_type: RetentionResourceType
  retention_days?: number
  is_enabled?: boolean
  schedule_interval_hours?: number
  description?: string | null
}

export interface RetentionPolicyUpdateInput {
  retention_days?: number
  is_enabled?: boolean
  schedule_interval_hours?: number
  description?: string | null
}

export interface ListPoliciesOptions {
  resourceType?: RetentionResourceType
  enabledOnly?: boolean
}

export interface ListRunsOptions {
  policyId?: string
  resourceType?: RetentionResourceType
  status?: RunStatus
  limit?: number
  offset?: number
}

export interface RunResult {
  policyId: string
  resourceType: RetentionResourceType
  status: RunStatus
  deletedCount: number
  error?: string
}
