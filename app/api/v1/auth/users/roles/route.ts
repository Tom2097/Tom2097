import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { createClient } from "@/lib/supabase/server"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/**
 * POST /api/v1/auth/users/roles
 * Assign a role to a user within the caller's organization.
 * Requires roles:assign.
 * Body: { userId: string, roleId: string }
 */
async function assignHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  let body: { userId?: string; roleId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.userId || !body.roleId) {
    return NextResponse.json({ error: "userId and roleId are required" }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify the role belongs to the caller's organization (tenant isolation)
  const { data: role } = await supabase
    .from("roles")
    .select("id, name, organization_id")
    .eq("id", body.roleId)
    .eq("organization_id", ctx.organizationId)
    .single()

  if (!role) {
    return NextResponse.json({ error: "Role not found in your organization" }, { status: 404 })
  }

  const { data: assignment, error } = await supabase
    .from("user_roles")
    .insert({
      user_id: body.userId,
      role_id: body.roleId,
      organization_id: ctx.organizationId,
      assigned_by: ctx.userId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "User already has this role" }, { status: 409 })
    }
    console.log("[v0] assign role error:", error.message)
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 })
  }

  await logAuthEvent({
    action: "rbac.role_assigned",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "user_role",
    resourceId: assignment.id,
    metadata: { targetUserId: body.userId, roleId: body.roleId, roleName: role.name },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ assignment }, { status: 201 })
}

/**
 * DELETE /api/v1/auth/users/roles
 * Revoke a role from a user within the caller's organization.
 * Requires roles:assign.
 * Body: { userId: string, roleId: string }
 */
async function revokeHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  let body: { userId?: string; roleId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.userId || !body.roleId) {
    return NextResponse.json({ error: "userId and roleId are required" }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", body.userId)
    .eq("role_id", body.roleId)
    .eq("organization_id", ctx.organizationId)

  if (error) {
    console.log("[v0] revoke role error:", error.message)
    return NextResponse.json({ error: "Failed to revoke role" }, { status: 500 })
  }

  await logAuthEvent({
    action: "rbac.role_revoked",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "user_role",
    metadata: { targetUserId: body.userId, roleId: body.roleId },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
}

export const POST = withAuth(assignHandler, { requireAll: ["roles:assign"] })
export const DELETE = withAuth(revokeHandler, { requireAll: ["roles:assign"] })
