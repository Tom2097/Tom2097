"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { createClient, getBearerToken } from "@/lib/supabase/server"
import { isCurrentUserPlatformOwner, isPlatformOwnerEmail } from "@/lib/platform/owner"
import { createAuditEntry } from "@/lib/audit/append-only"
import { createNotification } from "@/lib/notifications/engine"
import { randomUUID } from "crypto"

/**
 * Resolves the caller's identity from either the session cookie (browser) or
 * an Authorization: Bearer <token> header (mobile/API clients, no cookies).
 * Every plain `createClient().auth.getUser()` call in this file used to skip
 * the Bearer case, so a token-authenticated caller always looked signed-out
 * here even though the same token worked fine on other routes.
 */
async function getSessionUser() {
  const supabase = await createClient()
  const bearerToken = await getBearerToken()
  const {
    data: { user },
  } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser()
  return user
}

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
  const adminUser = await getSessionUser()
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

  // Platform owners must never be impersonated -- PLATFORM_OWNER_EMAIL
  // supports multiple comma-separated co-founders, and without this check
  // one owner could start a "consented" impersonation session against
  // another owner's account, silently escalating access between them.
  if (isPlatformOwnerEmail(targetProfile.email)) {
    return { error: "Cannot impersonate another platform owner" }
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

      // The target user has no other way to learn a request exists -- the
      // consent flow is meaningless without this, since nothing else surfaces
      // pending_consent rows to them.
      if (targetProfile.organization_id) {
        await createNotification(targetProfile.organization_id, {
          user_id: targetProfile.id,
          title: "Support access request",
          body: `${adminUser.email ?? "A platform admin"} is requesting temporary access to your account (${reason}). Approve or deny it.`,
          type: "warning",
          category: "security",
          priority: "urgent",
          source: "system",
          data: { kind: "impersonation_consent", sessionId: pendingId },
        }).catch((err) => console.error("[impersonation] failed to notify target user:", err))
      }
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
  const user = await getSessionUser()
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

/** Lets the target of a pending request refuse it outright, rather than just letting it expire. */
export async function denyImpersonationConsent(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()

  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .eq("id", sessionId)
    .single()

  if (!session) {
    return { success: false, error: "Session not found" }
  }

  const user = await getSessionUser()
  if (!user || user.id !== session.target_user_id) {
    return { success: false, error: "Only the target user can deny consent" }
  }

  const { error } = await supabase
    .from("impersonation_sessions")
    .update({ status: "denied", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", sessionId)

  if (error) {
    return { success: false, error: error.message }
  }

  const auditEntry = createAuditEntry(
    "impersonation_sessions",
    sessionId,
    "UPDATE",
    { status: session.status },
    { status: "denied" },
    user.id,
    session.target_organization_id
  )
  await supabase.from("audit_log_entries").insert(auditEntry)

  return { success: true }
}

export interface PendingImpersonationRequest {
  id: string
  adminEmail: string | null
  adminName: string | null
  reason: string
  startedAt: string
  expiresAt: string
}

/** Lists the caller's own pending (not yet consented, not expired) impersonation requests. */
export async function listPendingImpersonationRequests(userId: string): Promise<PendingImpersonationRequest[]> {
  const supabase = await createServiceClient()

  const { data: sessions } = await supabase
    .from("impersonation_sessions")
    .select("id, admin_user_id, reason, started_at, expires_at")
    .eq("target_user_id", userId)
    .eq("status", "pending_consent")
    .eq("consent_granted", false)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })

  if (!sessions || sessions.length === 0) return []

  const adminIds = [...new Set(sessions.map((s) => s.admin_user_id as string))]
  const { data: admins } = await supabase.from("profiles").select("id, email, full_name").in("id", adminIds)
  const adminById = new Map((admins ?? []).map((a) => [a.id, a]))

  return sessions.map((s) => {
    const admin = adminById.get(s.admin_user_id as string)
    return {
      id: s.id as string,
      adminEmail: admin?.email ?? null,
      adminName: admin?.full_name ?? null,
      reason: s.reason as string,
      startedAt: s.started_at as string,
      expiresAt: s.expires_at as string,
    }
  })
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
  const adminUser = await getSessionUser()
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
  const supabase = await createServiceClient()

  const user = await getSessionUser()
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
