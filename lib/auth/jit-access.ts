"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { createAuditEntry } from "@/lib/audit/append-only"
import { randomUUID } from "crypto"

export type ElevatedRole = "security_admin" | "billing_admin" | "super_admin"

export interface JitElevationRequest {
  id: string
  userId: string
  organizationId: string
  requestedRole: ElevatedRole
  reason: string
  durationMinutes: number
  status: "pending" | "approved" | "denied" | "expired" | "revoked"
  approvedBy?: string
  approvedAt?: string
  expiresAt: string
  createdAt: string
}

const MAX_ELEVATION_MINUTES = 120 // 2 hours max
const DEFAULT_ELEVATION_MINUTES = 30

export async function requestElevation(
  requestedRole: ElevatedRole,
  reason: string,
  durationMinutes: number = DEFAULT_ELEVATION_MINUTES
): Promise<{ request?: JitElevationRequest; error?: string }> {
  const supabase = await createServiceClient()
  const client = await createClient()
  
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile) return { error: "Profile not found" }

  // Validate duration
  const minutes = Math.min(durationMinutes, MAX_ELEVATION_MINUTES)
  if (minutes < 5) return { error: "Minimum elevation duration is 5 minutes" }

  const id = randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000)

  // Check for existing pending elevation
  const { data: existing } = await supabase
    .from("jit_elevation_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single()

  if (existing) {
    return { error: "You already have a pending elevation request" }
  }

  const { data: request, error } = await supabase
    .from("jit_elevation_requests")
    .insert({
      id,
      user_id: user.id,
      organization_id: profile.organization_id,
      requested_role: requestedRole,
      reason,
      duration_minutes: minutes,
      status: "pending",
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    })
    .select("*")
    .single()

  if (error) return { error: `Failed to create elevation request: ${error.message}` }

  // Log audit event
  const auditEntry = createAuditEntry(
    "jit_elevation_requests",
    id,
    "INSERT",
    null,
    { userId: user.id, role: requestedRole, reason, duration: minutes },
    user.id,
    profile.organization_id
  )
  await supabase.from("audit_log_entries").insert(auditEntry)

  return {
    request: {
      id: request.id,
      userId: request.user_id,
      organizationId: request.organization_id,
      requestedRole: request.requested_role,
      reason: request.reason,
      durationMinutes: request.duration_minutes,
      status: request.status,
      approvedBy: request.approved_by,
      approvedAt: request.approved_at,
      expiresAt: request.expires_at,
      createdAt: request.created_at,
    }
  }
}

export async function approveElevation(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) return { success: false, error: "Only platform owners can approve elevation requests" }

  const supabase = await createServiceClient()
  const client = await createClient()
  const { data: { user: approver } } = await client.auth.getUser()
  if (!approver) return { success: false, error: "Not authenticated" }

  const { data: request } = await supabase
    .from("jit_elevation_requests")
    .select("*")
    .eq("id", requestId)
    .eq("status", "pending")
    .single()

  if (!request) return { success: false, error: "Request not found or already processed" }

  const now = new Date()
  if (new Date(request.expires_at) < now) {
    await supabase
      .from("jit_elevation_requests")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("id", requestId)
    return { success: false, error: "Request has expired" }
  }

  const { error } = await supabase
    .from("jit_elevation_requests")
    .update({
      status: "approved",
      approved_by: approver.id,
      approved_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", requestId)

  if (error) return { success: false, error: error.message }

  // Grant temporary role
  await supabase.from("user_roles").upsert({
    user_id: request.user_id,
    role: request.requested_role,
    organization_id: request.organization_id,
    expires_at: request.expires_at,
    granted_by: approver.id,
    granted_at: now.toISOString(),
  })

  // Log audit
  const auditEntry = createAuditEntry(
    "jit_elevation_requests",
    requestId,
    "UPDATE",
    { status: "pending" },
    { status: "approved", approvedBy: approver.id },
    approver.id,
    request.organization_id
  )
  await supabase.from("audit_log_entries").insert(auditEntry)

  return { success: true }
}

export async function denyElevation(
  requestId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) return { success: false, error: "Forbidden" }

  const supabase = await createServiceClient()
  const client = await createClient()
  const { data: { user: denier } } = await client.auth.getUser()
  if (!denier) return { success: false, error: "Not authenticated" }

  const { error } = await supabase
    .from("jit_elevation_requests")
    .update({
      status: "denied",
      denial_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function revokeElevation(
  userId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()
  const { data: { user: caller } } = await client.auth.getUser()
  if (!caller) return { success: false, error: "Not authenticated" }

  // Users may always revoke their own elevation; revoking someone else's
  // requires platform-owner privileges.
  if (caller.id !== userId) {
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) return { success: false, error: "Forbidden" }
  }

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from("user_roles")
    .update({ expires_at: new Date().toISOString(), revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .is("expires_at", null)

  if (error) return { success: false, error: error.message }

  // Expire pending elevation requests
  await supabase
    .from("jit_elevation_requests")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "approved")

  return { success: true }
}

export async function cleanupExpiredElevations(): Promise<number> {
  const supabase = await createServiceClient()
  const now = new Date().toISOString()

  // Expire requests past their expiry
  const { data: expired } = await supabase
    .from("jit_elevation_requests")
    .update({ status: "expired", updated_at: now })
    .eq("status", "approved")
    .lt("expires_at", now)
    .select("user_id, organization_id")

  // Revoke expired user_roles
  for (const item of (expired || []) as Array<{ user_id: string; organization_id: string }>) {
    await supabase
      .from("user_roles")
      .update({ expires_at: now, revoked_at: now })
      .eq("user_id", item.user_id)
      .eq("organization_id", item.organization_id)
  }

  return (expired || []).length
}

export async function listElevationRequests(
  status?: JitElevationRequest["status"]
): Promise<JitElevationRequest[]> {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) return []

  const supabase = await createServiceClient()
  let query = supabase.from("jit_elevation_requests").select("*")

  if (status) {
    query = query.eq("status", status)
  }

  const { data } = await query.order("created_at", { ascending: false })

  return ((data as Record<string, unknown>[]) || []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    organizationId: r.organization_id as string,
    requestedRole: r.requested_role as ElevatedRole,
    reason: r.reason as string,
    durationMinutes: r.duration_minutes as number,
    status: r.status as JitElevationRequest["status"],
    approvedBy: r.approved_by as string | undefined,
    approvedAt: r.approved_at as string | undefined,
    expiresAt: r.expires_at as string,
    createdAt: r.created_at as string,
  }))
}

export async function getMyElevationStatus(): Promise<{
  active: boolean
  role?: ElevatedRole
  expiresAt?: string
  request?: JitElevationRequest
}> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { active: false }

  const supabase = await createServiceClient()

  // Check for active elevated role
  const { data: activeRole } = await supabase
    .from("user_roles")
    .select("role, expires_at")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .single()

  if (activeRole) {
    return {
      active: true,
      role: activeRole.role as ElevatedRole,
      expiresAt: activeRole.expires_at,
    }
  }

  // Check for pending request
  const { data: pending } = await supabase
    .from("jit_elevation_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single()

  if (pending) {
    return {
      active: false,
      request: {
        id: pending.id,
        userId: pending.user_id,
        organizationId: pending.organization_id,
        requestedRole: pending.requested_role,
        reason: pending.reason,
        durationMinutes: pending.duration_minutes,
        status: pending.status,
        expiresAt: pending.expires_at,
        createdAt: pending.created_at,
      },
    }
  }

  return { active: false }
}
