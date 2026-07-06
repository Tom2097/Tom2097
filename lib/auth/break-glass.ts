"use server"

import { createClient } from "../../lib/supabase/server"
import { getAuthenticatedUser } from "./server-auth"
import { isPlatformAdmin } from "./rbac"
import { createAuditLog } from "@/lib/audit/append-only"
import { randomUUID } from "crypto"

interface BreakGlassSession {
  id: string
  adminId: string
  reason: string
  createdAt: string
  expiresAt: string
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

  const supabase = createClient()
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + Math.min(durationMinutes, MAX_BREAK_GLASS_MINUTES))

  const sessionId = randomUUID()
  const { error } = await supabase.from("break_glass_sessions").insert({
    id: sessionId,
    admin_id: user.id,
    reason,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error("Failed to create break-glass session:", error)
    return { success: false, error: error.message }
  }

  // Audit log
  await createAuditLog({
    action: "break_glass_request",
    userId: user.id,
    metadata: {
      reason,
      durationMinutes,
      expiresAt: expiresAt.toISOString(),
    },
  })

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

  const supabase = createClient()
  const { error } = await supabase
    .from("break_glass_sessions")
    .update({ expires_at: new Date().toISOString() })
    .eq("admin_id", user.id)
    .is("expires_at", null)

  if (error) {
    console.error("Failed to end break-glass session:", error)
    return { success: false, error: error.message }
  }

  // Audit log
  await createAuditLog({
    action: "break_glass_end",
    userId: user.id,
    metadata: { manualEnd: true },
  })

  return { success: true }
}

/**
 * Gets the active break-glass session for the current user.
 */
export async function getActiveBreakGlassSession(): Promise<BreakGlassSession | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = createClient()
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
    reason: data.reason,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
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