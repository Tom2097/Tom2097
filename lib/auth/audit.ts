import { createClient } from "@/lib/supabase/server"

/**
 * Auth audit logging (Module #2).
 * Records authentication and authorization events into the shared
 * public.audit_logs table. Events are scoped to an organization so they
 * are protected by the table's tenant RLS policies.
 */

export type AuthAuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.session_refreshed"
  | "auth.permission_denied"
  | "rbac.role_created"
  | "rbac.role_updated"
  | "rbac.role_deleted"
  | "rbac.role_assigned"
  | "rbac.role_revoked"
  | "rbac.permission_granted"
  | "rbac.permission_revoked"

export interface AuthAuditEntry {
  action: AuthAuditAction
  userId?: string | null
  organizationId?: string | null
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

/**
 * Write an auth event to the audit log. Best-effort: failures are logged
 * but never thrown, so auditing never blocks the primary auth flow.
 */
export async function logAuthEvent(entry: AuthAuditEntry): Promise<void> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from("audit_logs").insert({
      action: entry.action,
      user_id: entry.userId ?? null,
      organization_id: entry.organizationId ?? null,
      resource_type: entry.resourceType ?? "auth",
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ipAddress ?? null,
    })

    if (error) {
      console.log("[v0] Failed to write auth audit log:", error.message)
    }
  } catch (err) {
    console.log("[v0] Unexpected error writing auth audit log:", err)
  }
}

/**
 * Extract the client IP address from request headers.
 * Falls back to null when no forwarded headers are present.
 */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return headers.get("x-real-ip")
}
