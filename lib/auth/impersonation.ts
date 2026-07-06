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

export async function startImpersonation(
  targetUserId: string,
  reason: string
): Promise<{ session?: ImpersonationSession; error?: string }> {
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

  // Check for active impersonation sessions
  const { data: activeSession } = await supabase
    .from("impersonation_sessions")
    .select("id")
    .eq("admin_user_id", adminUser.id)
    .eq("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .single()

  if (activeSession) {
    return { error: "You already have an active impersonation session. End it before starting a new one." }
  }

  const sessionId = randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + MAX_IMPERSONATION_MINUTES * 60 * 1000)

  // Create impersonation session
  const { data: session, error } = await supabase
    .from("impersonation_sessions")
    .insert({
      id: sessionId,
      admin_user_id: adminUser.id,
      target_user_id: targetProfile.id,
      target_email: targetProfile.email,
      target_organization_id: targetProfile.organization_id,
      reason,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      consent_granted: false,
      status: "active",
    })
    .select("*")
    .single()

  if (error) {
    return { error: `Failed to create impersonation session: ${error.message}` }
  }

  // Log audit event
  const auditEntry = createAuditEntry(
    "impersonation_sessions",
    sessionId,
    "INSERT",
    null,
    { adminUserId: adminUser.id, targetUserId: targetProfile.id, reason },
    adminUser.id,
    targetProfile.organization_id
  )
  
  await supabase.from("audit_log_entries").insert(auditEntry)

  return {
    session: {
      id: session.id,
      adminUserId: session.admin_user_id,
      targetUserId: session.target_user_id,
      targetEmail: session.target_email,
      targetOrganizationId: session.target_organization_id,
      reason: session.reason,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      endedAt: session.ended_at,
      consentGranted: session.consent_granted,
    }
  }
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

  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .eq("admin_user_id", user.id)
    .eq("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .single()

  if (!session) return null

  return {
    id: session.id,
    adminUserId: session.admin_user_id,
    targetUserId: session.target_user_id,
    targetEmail: session.target_email,
    targetOrganizationId: session.target_organization_id,
    reason: session.reason,
    startedAt: session.started_at,
    expiresAt: session.expires_at,
    endedAt: session.ended_at,
    consentGranted: session.consent_granted,
  }
}

export async function isCurrentlyImpersonating(): Promise<boolean> {
  const session = await getActiveImpersonationSession()
  return session !== null
}

export async function listActiveImpersonations(): Promise<ImpersonationSession[]> {
  const supabase = await createServiceClient()
  
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) return []

  const { data: sessions } = await supabase
    .from("impersonation_sessions")
    .select("*")
    .eq("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })

  return (sessions ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    adminUserId: s.admin_user_id as string,
    targetUserId: s.target_user_id as string,
    targetEmail: s.target_email as string,
    targetOrganizationId: s.target_organization_id as string,
    reason: s.reason as string,
    startedAt: s.started_at as string,
    expiresAt: s.expires_at as string,
    endedAt: s.ended_at as string | null,
    consentGranted: s.consent_granted as boolean,
  }))
}
