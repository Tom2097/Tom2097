"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { createAuditEntry } from "@/lib/audit/append-only"
import { randomUUID } from "crypto"

export interface BreakGlassSession {
  id: string
  userId: string
  organizationId: string
  reason: string
  role: string
  status: "active" | "expired" | "revoked"
  startedAt: string
  expiresAt: string
  justification: string
  alarmTriggered: boolean
}

const BREAK_GLASS_DURATION_MINUTES = 15
const BREAK_GLASS_NOTIFY_EMAILS = (process.env.BREAK_GLASS_NOTIFY_EMAILS || "").split(",").filter(Boolean)

export async function activateBreakGlass(
  reason: string,
  justification: string
): Promise<{ session?: BreakGlassSession; error?: string }> {
  const supabase = await createServiceClient()
  const client = await (await import("@/lib/supabase/server")).createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, email")
    .eq("id", user.id)
    .single()

  if (!profile) return { error: "Profile not found" }

  const id = randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + BREAK_GLASS_DURATION_MINUTES * 60 * 1000)

  const { data: session, error } = await supabase
    .from("break_glass_sessions")
    .insert({
      id,
      user_id: user.id,
      organization_id: profile.organization_id,
      reason,
      role: "super_admin",
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      justification,
    })
    .select("*")
    .single()

  if (error) return { error: `Failed to create break-glass session: ${error.message}` }

  // Trigger alarm - log with maximum visibility
  const auditEntry = createAuditEntry(
    "break_glass_sessions",
    id,
    "INSERT",
    null,
    { userId: user.id, reason, justification },
    user.id,
    profile.organization_id
  )
  await supabase.from("audit_log_entries").insert({
    ...auditEntry,
    metadata: { ...auditEntry.metadata, alarm: true, severity: "critical" },
  })

  // Send notifications (simulated)
  for (const email of BREAK_GLASS_NOTIFY_EMAILS) {
    console.warn(`[BREAK-GLASS] ALARM: User ${user.email} activated break-glass. Notifying ${email}`)
  }

  // Grant temporary super_admin role
  await supabase.from("user_roles").upsert({
    user_id: user.id,
    role: "super_admin",
    organization_id: profile.organization_id,
    expires_at: expiresAt.toISOString(),
    granted_by: user.id,
    granted_at: now.toISOString(),
    break_glass: true,
  })

  return {
    session: {
      id: session.id,
      userId: session.user_id,
      organizationId: session.organization_id,
      reason: session.reason,
      role: session.role,
      status: session.status,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      justification: session.justification,
      alarmTriggered: true,
    }
  }
}

export async function revokeBreakGlass(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()
  
  const { data: session } = await supabase
    .from("break_glass_sessions")
    .select("*")
    .eq("id", sessionId)
    .single()

  if (!session) return { success: false, error: "Session not found" }

  const now = new Date().toISOString()
  await supabase.from("break_glass_sessions").update({ status: "revoked", revoked_at: now }).eq("id", sessionId)
  await supabase.from("user_roles").update({ expires_at: now, revoked_at: now }).eq("user_id", session.user_id).eq("break_glass", true)

  return { success: true }
}

export async function cleanupExpiredBreakGlass(): Promise<number> {
  const supabase = await createServiceClient()
  const now = new Date().toISOString()
  
  const { data: expired } = await supabase
    .from("break_glass_sessions")
    .update({ status: "expired", revoked_at: now })
    .eq("status", "active")
    .lt("expires_at", now)
    .select("user_id")

  for (const item of (expired || []) as Array<Record<string, unknown>>) {
    await supabase.from("user_roles").update({ expires_at: now }).eq("user_id", item.user_id as string).eq("break_glass", true)
  }

  return (expired || []).length
}
