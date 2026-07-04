import { createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"

function computeAuditHash(entry: AuthAuditEntry, previousHash: string | null): string {
  const data = JSON.stringify({ ...entry, previousHash })
  return createHash("sha256").update(data).digest("hex")
}

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
  // Module #3: per-role permission editing
  | "rbac.permission_added"
  | "rbac.permission_removed"
  // Module #3: teams / groups
  | "rbac.team_created"
  | "rbac.team_updated"
  | "rbac.team_deleted"
  | "rbac.team_member_added"
  | "rbac.team_member_removed"
  | "rbac.team_role_assigned"
  | "rbac.team_role_removed"
  // Module #4: universal search
  | "search.documents_indexed"
  | "search.document_removed"
  | "search.backfilled"
  // Module #6: workflow automation
  | "workflow.created"
  | "workflow.updated"
  | "workflow.deleted"
  | "workflow.enabled"
  | "workflow.disabled"
  | "workflow.executed"
  // Module #7: analytics engine
  | "analytics.report_created"
  | "analytics.report_updated"
  | "analytics.report_deleted"
  | "analytics.exported"
  // Module #8: notification system
  | "notification.created"
  | "notification.broadcast"
  | "notification.preferences_updated"
  // Module #9: billing system
  | "billing.session_created"
  | "billing.subscription_created"
  | "billing.subscription_updated"
  | "billing.subscription_cancelled"
  | "billing.payment_completed"
  | "billing.payment_failed"
  | "billing.trial_started"
  | "billing.refund_processed"
  // Module #10: audit logging
  | "audit.exported"
  | "audit.retention_updated"
  | "audit.retention_cleanup"
  // Module #11: feedback management
  | "feedback.created"
  | "feedback.updated"
  | "feedback.status_changed"
  | "feedback.assigned"
  | "feedback.deleted"
  | "feedback.commented"
  | "feedback.voted"
  | "feedback.unvoted"
  // Module #12: document management
  | "document.uploaded"
  | "document.updated"
  | "document.version_added"
  | "document.downloaded"
  | "document.deleted"
  // Module #13: reporting engine
  | "report.created"
  | "report.updated"
  | "report.deleted"
  | "report.scheduled"
  | "report.generated"
  // Module #21: monitoring & reliability
  | "monitor.created"
  | "monitor.updated"
  | "monitor.deleted"
  | "monitor.checked"
  | "incident.created"
  | "incident.updated"
  | "incident.resolved"
  // Module #19: integration hub
  | "integration.created"
  | "integration.updated"
  | "integration.deleted"
  | "integration.tested"
  | "integration.dispatched"
  | "integration.delivery_failed"
  // Module #17: customer CRM
  | "crm.company_created"
  | "crm.company_updated"
  | "crm.company_deleted"
  | "crm.contact_created"
  | "crm.contact_updated"
  | "crm.contact_deleted"
  | "crm.deal_created"
  | "crm.deal_updated"
  | "crm.deal_deleted"
  | "crm.activity_logged"
  // Module #18: knowledge base
  | "kb.category_created"
  | "kb.category_updated"
  | "kb.category_deleted"
  | "kb.article_created"
  | "kb.article_updated"
  | "kb.article_published"
  | "kb.article_unpublished"
  | "kb.article_deleted"
  | "kb.article_feedback"
  // Module #14: legal & compliance
  | "legal.document_created"
  | "legal.document_updated"
  | "legal.document_published"
  | "legal.document_archived"
  | "legal.document_deleted"
  | "legal.consent_recorded"
  | "legal.dsar_created"
  | "legal.dsar_updated"
  | "legal.dsar_completed"
  | "legal.dsar_rejected"
  // Module #15: data retention
  | "retention.policy_created"
  | "retention.policy_updated"
  | "retention.policy_deleted"
  | "retention.purge_run"
  | "retention.purge_failed"
  // Settings
  | "auth.password_changed"
  | "auth.account_deleted"
  | "auth.invitation_sent"
  | "auth.api_key_generated"
  | "auth.api_key_revoked"
  | "auth.organization_updated"
  // Module #20: localization system
  | "localization.locale_created"
  | "localization.locale_updated"
  | "localization.locale_deleted"
  | "localization.default_changed"
  | "localization.key_created"
  | "localization.key_updated"
  | "localization.key_deleted"
  | "localization.translation_updated"

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
    const supabase = await createServiceClient()

    const { data: lastEntry } = await supabase
      .from("audit_logs")
      .select("hash")
      .order("created_at", { ascending: false })
      .limit(1)
    const previousHash = (lastEntry?.[0]?.hash as string) ?? null
    const hash = computeAuditHash(entry, previousHash)

    const { error } = await supabase.from("audit_logs").insert({
      action: entry.action,
      user_id: entry.userId ?? null,
      organization_id: entry.organizationId ?? null,
      resource_type: entry.resourceType ?? "auth",
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ipAddress ?? null,
      hash,
      previous_hash: previousHash,
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
