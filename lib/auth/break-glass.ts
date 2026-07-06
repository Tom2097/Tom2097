"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthenticatedUser } from "./server-auth"
import { isPlatformAdmin } from "@/lib/auth/rbac"
import { createAuditEntry } from "@/lib/audit/append-only"
import { randomUUID } from "crypto"

export interface BreakGlassSession {
  id: string
  adminId: string
  adminName?: string
  adminEmail?: string
  reason: string
  role: string
  status: "active" | "ended" | "expired"
  alarmTriggered: boolean
  createdAt: string
  startedAt: string
  expiresAt: string
  endedAt?: string | null
}

const MAX_BREAK_GLASS_MINUTES = 30

/**
 * Requests break-glass emergency access.
 */
export async function requestBreakGlassAccess(
  reason: string,
  durationMinutes: number = MAX_BREAK_GLASS_MINUTES
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const isAdmin = await isPlatformAdmin(user.id)
  if (!isAdmin) return { success: false, error: "Forbidden" }

  const supabase = await createClient()
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + Math.min(durationMinutes, MAX_BREAK_GLASS_MINUTES))

  const sessionId = randomUUID()
  const { error } = await supabase.from("break_glass_sessions").insert({
    id: sessionId,
    admin_id: user.id,
    reason,
    role: "platform_admin",
    status: "active",
    alarm_triggered: true,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error("Failed to create break-glass session:", error)
    return { success: false, error: error.message }
  }

  // Audit log
  await createAuditEntry(
    "break_glass_sessions",
    sessionId,
    "INSERT",
    null,
    {
      adminId: user.id,
      reason,
      durationMinutes,
      expiresAt: expiresAt.toISOString(),
    },
    user.id,
    ""
  )

  // Trigger alarm (e.g., Slack, PagerDuty)
  await triggerBreakGlassAlarm(user.id, reason, expiresAt)

  return { success: true }
}

/**
 * Ends the active break-glass session.
 */
export async function endBreakGlassSession() {
  const user = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("break_glass_sessions")
    .update({
      expires_at: new Date().toISOString(),
      status: "ended",
      ended_at: new Date().toISOString(),
    })
    .eq("admin_id", user.id)
    .is("expires_at", null)

  if (error) {
    console.error("Failed to end break-glass session:", error)
    return { success: false, error: error.message }
  }

  // Audit log
  await createAuditEntry(
    "break_glass_sessions",
    user.id,
    "UPDATE",
    { status: "active" },
    { status: "ended" },
    user.id,
    ""
  )

  return { success: true }
}

/**
 * Gets the active break-glass session for the current user.
 */
export async function getActiveBreakGlassSession(): Promise<BreakGlassSession | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("break_glass_sessions")
    .select("*")
    .eq("admin_id", user.id)
    .is("expires_at", null)
    .or(`expires_at.gt.now()`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!data) return null

  return {
    id: data.id,
    adminId: data.admin_id,
    adminName: data.admin_name,
    adminEmail: data.admin_email,
    reason: data.reason,
    role: data.role || "platform_admin",
    status: data.status || "active",
    alarmTriggered: data.alarm_triggered || false,
    createdAt: data.created_at,
    startedAt: data.started_at || data.created_at,
    expiresAt: data.expires_at,
    endedAt: data.ended_at,
  }
}

/**
 * Checks if break-glass access is active for the current user.
 */
export async function isBreakGlassActive(): Promise<boolean> {
  const session = await getActiveBreakGlassSession()
  return session !== null
}

/**
 * Triggers an alarm for break-glass access (e.g., Slack, PagerDuty).
 */
async function triggerBreakGlassAlarm(adminId: string, reason: string, expiresAt: Date) {
  // TODO: Integrate with Slack/PagerDuty
  console.warn("BREAK-GLASS ALARM:", {
    adminId,
    reason,
    expiresAt: expiresAt.toISOString(),
  })
}
