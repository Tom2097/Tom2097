/**
 * Module #10 – Audit Log query store.
 * All reads use the service client so they are not gated by the user-facing
 * RLS select policy (permission is enforced by the API layer via withAuth).
 */

import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditLogListResult,
  AuditLogStats,
} from "./types"

const MAX_LIMIT = 500

/** List audit log entries for an organization with filters and pagination. */
export async function listAuditLogs(
  organizationId: string,
  filters: AuditLogFilters = {},
  limit = 50,
  offset = 0
): Promise<AuditLogListResult> {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT)
  const supabase = await createServiceClient()

  let query = supabase
    .from("audit_logs")
    .select(
      "id, organization_id, user_id, action, resource_type, resource_id, metadata, ip_address, created_at",
      { count: "exact" }
    )
    .eq("organization_id", organizationId)

  if (filters.action) query = query.eq("action", filters.action)
  if (filters.userId) query = query.eq("user_id", filters.userId)
  if (filters.resourceType) query = query.eq("resource_type", filters.resourceType)
  if (filters.resourceId) query = query.eq("resource_id", filters.resourceId)
  if (filters.since) query = query.gte("created_at", filters.since)
  if (filters.until) query = query.lte("created_at", filters.until)

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1)

  if (error) throw error

  return {
    entries: (data ?? []) as AuditLogEntry[],
    total: count ?? 0,
    limit: safeLimit,
    offset,
  }
}

/** Fetch a single audit log entry by ID (org-scoped). */
export async function getAuditLogEntry(
  organizationId: string,
  entryId: string
): Promise<AuditLogEntry | null> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("id", entryId)
    .eq("organization_id", organizationId)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }

  return data as AuditLogEntry
}

/** Get aggregated stats for an organization using the SECURITY DEFINER fn. */
export async function getAuditLogStats(
  organizationId: string,
  days = 30
): Promise<AuditLogStats> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase.rpc("get_audit_log_stats", {
    p_org_id: organizationId,
    p_days: days,
  })

  if (error) throw error

  return data as AuditLogStats
}

/** Export audit log entries as CSV string (max 10 000 rows). */
export async function exportAuditLogs(
  organizationId: string,
  filters: AuditLogFilters = {}
): Promise<string> {
  const result = await listAuditLogs(organizationId, filters, 10_000, 0)

  const header = [
    "id",
    "created_at",
    "action",
    "user_id",
    "resource_type",
    "resource_id",
    "ip_address",
    "metadata",
  ].join(",")

  const rows = result.entries.map((e) =>
    [
      e.id,
      e.created_at,
      e.action,
      e.user_id ?? "",
      e.resource_type ?? "",
      e.resource_id ?? "",
      e.ip_address ?? "",
      JSON.stringify(e.metadata ?? {}),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  )

  return [header, ...rows].join("\n")
}

/** Run retention cleanup for an org using the SECURITY DEFINER procedure. */
export async function runRetentionCleanup(
  organizationId: string,
  retentionDays: number,
  triggeredByUserId?: string
): Promise<number> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase.rpc("audit_retention_cleanup", {
    p_org_id: organizationId,
    p_retention_days: retentionDays,
  })

  if (error) throw error

  const deleted = (data as number) ?? 0

  // Record the cleanup event itself
  await logAuthEvent({
    action: "audit.retention_cleanup",
    userId: triggeredByUserId,
    organizationId,
    resourceType: "audit_logs",
    metadata: { retention_days: retentionDays, deleted_count: deleted },
  })

  return deleted
}
