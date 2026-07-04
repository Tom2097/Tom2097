"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

interface RoleApprovalRequest {
  id: string
  userId: string
  requestedRole: "owner" | "admin" | "member"
  companyId: string
  status: "pending" | "approved" | "rejected"
  requestedAt: string
  approvedAt?: string
  approvedBy?: string
  notes?: string
}

/**
 * Request role approval for high-privilege roles
 */
export async function requestRoleApproval(
  userId: string,
  companyId: string,
  requestedRole: "owner" | "admin" | "member"
): Promise<{ success: boolean; approvalId?: string }> {
  const db = createServiceClient()

  // Members don't need approval
  if (requestedRole === "member") {
    return { success: true }
  }

  try {
    // Check if there are existing owners/admins who can approve
    const { count: approverCount } = await db
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", companyId)
      .in("role", requestedRole === "owner" ? ["owner"] : ["owner", "admin"])
      .neq("user_id", userId)

    if ((approverCount || 0) === 0) {
      // No approvers available - auto-approve if this is the first user
      const { count: memberCount } = await db
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", companyId)

      if ((memberCount || 0) === 0) {
        // First user in the company - auto-approve
        return { success: true }
      }
    }

    // Create approval request
    const { data: approval, error } = await db
      .from("role_approval_requests")
      .insert({
        user_id: userId,
        organization_id: companyId,
        requested_role: requestedRole,
        status: "pending",
        requested_at: new Date().toISOString()
      })
      .select("id")
      .single()

    if (error) throw error

    return { success: true, approvalId: approval.id }
  } catch (err) {
    logger.logError("[role-approval] Failed to request role approval:", { error: err })
    return { success: false }
  }
}

/**
 * Approve or reject a role request
 */
export async function processRoleApproval(
  approvalId: string,
  approverId: string,
  action: "approve" | "reject",
  notes?: string
): Promise<{ success: boolean }> {
  const db = createServiceClient()

  try {
    // Get the approval request
    const { data: approval } = await db
      .from("role_approval_requests")
      .select("*")
      .eq("id", approvalId)
      .single()

    if (!approval) {
      return { success: false }
    }

    // Check if approver has permission
    const { data: approver } = await db
      .from("organization_members")
      .select("role")
      .eq("user_id", approverId)
      .eq("organization_id", approval.organization_id)
      .single()

    if (!approver) {
      return { success: false }
    }

    // Check if approver has sufficient privileges
    const requiredRole = approval.requested_role === "owner" ? "owner" : "admin"
    if (approver.role !== requiredRole) {
      return { success: false }
    }

    // Update approval request
    await db
      .from("role_approval_requests")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        approved_at: action === "approve" ? new Date().toISOString() : undefined,
        approved_by: approverId,
        notes: notes || approval.notes
      })
      .eq("id", approvalId)

    if (action === "approve") {
      // Update the user's role
      await db
        .from("organization_members")
        .update({ role: approval.requested_role })
        .eq("user_id", approval.user_id)
        .eq("organization_id", approval.organization_id)
    }

    return { success: true }
  } catch (err) {
    logger.logError("[role-approval] Failed to process role approval:", { error: err })
    return { success: false }
  }
}

/**
 * Get pending role approval requests for a company
 */
export async function getPendingRoleApprovals(companyId: string): Promise<RoleApprovalRequest[]> {
  const db = createServiceClient()

  try {
    const { data: approvals } = await db
      .from("role_approval_requests")
      .select("*")
      .eq("organization_id", companyId)
      .eq("status", "pending")
      .order("requested_at", { ascending: true })

    return approvals || []
  } catch (err) {
    logger.logError("[role-approval] Failed to get pending approvals:", { error: err })
    return []
  }
}

/**
 * Check if a user's role requires approval
 */
export async function roleRequiresApproval(
  userId: string,
  companyId: string,
  requestedRole: "owner" | "admin" | "member"
): Promise<boolean> {
  // Members never require approval
  if (requestedRole === "member") return false

  const db = createServiceClient()

  try {
    // Check if there are existing owners/admins who can approve
    const { count: approverCount } = await db
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", companyId)
      .in("role", requestedRole === "owner" ? ["owner"] : ["owner", "admin"])
      .neq("user_id", userId)

    // If there are approvers, then approval is required
    return (approverCount || 0) > 0
  } catch (err) {
    logger.logError("[role-approval] Failed to check if role requires approval:", { error: err })
    // Default to requiring approval if we can't check
    return true
  }
}