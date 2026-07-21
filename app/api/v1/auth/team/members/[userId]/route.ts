import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

/** Extract the [userId] segment from /api/v1/auth/team/members/{userId}. */
function targetUserIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  return parts[parts.indexOf("members") + 1] ?? ""
}

// PATCH /api/v1/auth/team/members/[userId]
// Body: { role: "admin" | "member" | "viewer" }
//
// Owner/Admin-only team role management -- this surface didn't exist at
// all before (Settings only ever showed the caller's own profile). Owner
// is deliberately never settable here: it only ever changes via org
// creation (app/auth/callback/route.ts) or the dedicated
// transfer-ownership endpoint, which is the only path that can move
// ownership without ever leaving an org with zero or multiple owners.
async function patchHandler(
  req: NextRequest,
  ctx: AuthContext & { params: Record<string, string> },
): Promise<NextResponse> {
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Only owners and admins can manage team roles" }, { status: 403 })
  }

  const targetUserId = targetUserIdFromPath(req)
  if (!targetUserId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 })
  }

  let body: { role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const requestedRole = body.role
  if (!requestedRole || !ASSIGNABLE_ROLES.includes(requestedRole as AssignableRole)) {
    return NextResponse.json(
      { error: "role must be one of: admin, member, viewer" },
      { status: 400 },
    )
  }

  if (targetUserId === ctx.userId) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 })
  }

  // Admins may only ever move a teammate between member/viewer -- never
  // promote to admin, and never touch owner (enforced below via the
  // current-role check regardless of caller).
  if (ctx.role === "admin" && requestedRole === "admin") {
    return NextResponse.json(
      { error: "Only the owner can promote a team member to admin" },
      { status: 403 },
    )
  }

  const db = createServiceClient()

  const { data: target, error: targetError } = await db
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", targetUserId)
    .maybeSingle()

  if (targetError || !target || target.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: "Team member not found in your organization" }, { status: 404 })
  }

  // The owner's role can only ever change via transfer-ownership -- that's
  // the only path guaranteed to never leave the org with zero owners.
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Use the transfer-ownership endpoint to change the owner" },
      { status: 400 },
    )
  }

  const { data: updated, error: updateError } = await db
    .from("profiles")
    .update({ role: requestedRole })
    .eq("id", targetUserId)
    .eq("organization_id", ctx.organizationId)
    .select("id, full_name, email, role, created_at")
    .single()

  if (updateError || !updated) {
    console.error("[team/members] Error updating member role:", updateError)
    return NextResponse.json({ error: "Failed to update team member role" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.team_role_updated",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "profile",
    resourceId: targetUserId,
    metadata: { newRole: requestedRole, previousRole: target.role },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ member: updated })
}

export const PATCH = withAuth(patchHandler)
