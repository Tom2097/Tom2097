"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { isCurrentUserPlatformOwner, isPlatformOwnerEmail } from "@/lib/platform/owner"
import { createAuditEntry } from "@/lib/audit/append-only"
import { randomUUID } from "crypto"

export interface ImpersonationSession {
  id: string
  adminUserId: string
  targetUserId: string
  targetEmail: string
  targetOrganizationId: string
  reason: string
  startedAt: string
  expiresAt: string
  endedAt: string | null
  consentGranted: boolean
}

const MAX_IMPERSONATION_MINUTES = 60 // sessions auto-expire after 1 hour
const CONSENT_WINDOW_MINUTES = 15 // how long a pending consent request stays valid

function toImpersonationSession(session: Record<string, unknown>): ImpersonationSession {
  return {
    id: session.id as string,
    adminUserId: session.admin_user_id as string,
    targetUserId: session.target_user_id as string,
    targetEmail: session.target_email as string,
    targetOrganizationId: session.target_organization_id as string,
    reason: session.reason as string,
    startedAt: session.started_at as string,
    expiresAt: session.expires_at as string,
    endedAt: session.ended_at as string | null,
    consentGranted: session.consent_granted as boolean,
  }
}

/**
 * Starts (or requests) an impersonation session.
 *
 * Impersonation requires the target user's explicit consent -- the UI
 * (app/admin/impersonation/page.tsx) has always said "Target user consent is
 * required before accessing their data", but nothing ever enforced it. This
 * is now a two-step flow built on the existing `impersonation_sessions`
 * table (no schema change needed):
 *
 *   1. First call: no consented request exists yet for this admin/target
 *      pair, so one is created with status "pending_consent" and consent
 *      not granted. The call is rejected -- there is no session to use yet.
 *   2. The target user calls grantImpersonationConsent(sessionId) to flip
 *      consent_granted to true on that pending request.
 *   3. Second call (same admin/target): the now-consented pending request is
 *      found and activated (status -> "active", timer reset to the normal
 *      60-minute window) and a real session is returned.
 */
export async function startImpersonation(
  targetUserId: string,
  reason: string
): Promise<{ session?: ImpersonationSession; error?: string; pendingConsent?: boolean }> {
  // Verify the current user is a platform owner
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) {
    return { error: "Only platform owners can impersonate users" }
  }

  const supabase = await createServiceClient()

  // Get admin user
  const { data: { user: adminUser } } = await (await createClient()).auth.getUser()
  if (!adminUser) {
    return { error: "Not authenticated" }
  }

  // Get target user details
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, email, organization_id, full_name")
    .eq("id", targetUserId)
    .single()

  if (!targetProfile) {
    return { error: "Target user not found" }
  }

  const now = new Date()

  // Only one already-active (consented) impersonation session per admin at a time.
  const { data: activeSession } = await supabase
    .from("impersonation_sessions")
    .select("id")
    .eq("admin_user_id", adminUser.id)
    .eq("status", "active")
    .is("ended_at", null)
    .gt("expires_at", now.toISOString())
    .maybeSingle()

  if (activeSession) {
    return { error: "You already have an active impersonation session. End it before starting a new one." }
  }

  // Look for an outstanding (non-expired, non-ended) consent request between
  // this admin and target.
  const { data: existingRequest } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .eq("admin_user_id", adminUser.id)
    .eq("target_user_id", targetUserId)
    .eq("status", "pending_consent")
    .is("ended_at", null)
    .gt("expires_at", now.toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existingRequest || !existingRequest.consent_granted) {
    if (!existingRequest) {
      const pendingId = randomUUID()
      const pendingExpiresAt = new Date(now.getTime() + CONSENT_WINDOW_MINUTES * 60 * 1000)

      const { error: insertError } = await supabase.from("impersonation_sessions").insert({
        id: pendingId,
        admin_user_id: adminUser.id,
        target_user_id: targetProfile.id,
        target_email: targetProfile.email,
        target_organization_id: targetProfile.organization_id,
        reason,
        started_at: now.toISOString(),
        expires_at: pendingExpiresAt.toISOString(),
        consent_granted: false,
        status: "pending_consent",
      })

      if (insertError) {
        return { error: `Failed to create impersonation consent request: ${insertError.message}` }
      }

      const auditEntry = createAuditEntry(
        "impersonation_sessions",
        pendingId,
        "INSERT",
        null,
        { adminUserId: adminUser.id, targetUserId: targetProfile.id, reason, status: "pending_consent" },
        adminUser.id,
        targetProfile.organization_id
      )
      await supabase.from("audit_log_entries").insert(auditEntry)
    }

    return {
      error:
        "Target user consent is required before impersonation can begin. A consent request has been created and is pending the target user's approval.",
      pendingConsent: true,
    }
  }

  // Consent has been granted -- activate the session for real access.
  const expiresAt = new Date(now.getTime() + MAX_IMPERSONATION_MINUTES * 60 * 1000)
  const { data: session, error } = await supabase
    .from("impersonation_sessions")
    .update({
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", existingRequest.id)
    .select("*")
    .single()

  if (error || !session) {
    return { error: `Failed to start impersonation session: ${error?.message ?? "unknown error"}` }
  }

  // Log audit event
  const auditEntry = createAuditEntry(
    "impersonation_sessions",
    session.id,
    "UPDATE",
    { status: "pending_consent" },
    { status: "active", adminUserId: adminUser.id, targetUserId: targetProfile.id },
    adminUser.id,
    targetProfile.organization_id
  )

  await supabase.from("audit_log_entries").insert(auditEntry)

  return { session: toImpersonationSession(session) }
}

export async function grantImpersonationConsent(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()
  
  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .eq("id", sessionId)
    .single()

  if (!session) {
    return { success: false, error: "Session not found" }
  }

  if (session.consent_granted) {
    return { success: true } // already consented
  }

  // Verify the consent is being granted by the target user
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user || user.id !== session.target_user_id) {
    return { success: false, error: "Only the target user can grant consent" }
  }

  const { error } = await supabase
    .from("impersonation_sessions")
    .update({ consent_granted: true, updated_at: new Date().toISOString() })
    .eq("id", sessionId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function endImpersonation(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()
  
  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .eq("id", sessionId)
    .single()

  if (!session) {
    return { success: false, error: "Session not found" }
  }

  const { error } = await supabase
    .from("impersonation_sessions")
    .update({ ended_at: new Date().toISOString(), status: "ended", updated_at: new Date().toISOString() })
    .eq("id", sessionId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log audit event
  const { data: { user: adminUser } } = await (await createClient()).auth.getUser()
  if (adminUser) {
    const auditEntry = createAuditEntry(
      "impersonation_sessions",
      sessionId,
      "UPDATE",
      { status: "active" },
      { status: "ended" },
      adminUser.id,
      session.target_organization_id
    )
    await supabase.from("audit_log_entries").insert(auditEntry)
  }

  return { success: true }
}

export async function getActiveImpersonationSession(): Promise<ImpersonationSession | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Only a truly "active" (consented) session counts here -- a pending
  // consent request must never be treated as a live impersonation session.
  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .eq("admin_user_id", user.id)
    .eq("status", "active")
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) return null

  return toImpersonationSession(session)
}

export async function isCurrentlyImpersonating(): Promise<boolean> {
  const session = await getActiveImpersonationSession()
  return session !== null
}

export async function listActiveImpersonations(): Promise<ImpersonationSession[]> {
  const supabase = await createServiceClient()

  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) return []

  // Includes both "active" sessions and outstanding "pending_consent"
  // requests so the admin UI's Pending/Granted consent badge has something
  // to show while a request is awaiting the target user's approval.
  const { data: sessions } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })

  return (sessions ?? []).map((s: Record<string, unknown>) => toImpersonationSession(s))
}
