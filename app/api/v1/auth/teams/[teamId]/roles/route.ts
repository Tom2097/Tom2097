import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { assignRoleToTeam, removeRoleFromTeam } from "@/lib/auth/teams"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/** Extract the [teamId] segment from /api/v1/auth/teams/{teamId}/roles. */
function teamIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  return parts[parts.indexOf("teams") + 1] ?? ""
}

/**
 * POST /api/v1/auth/teams/[teamId]/roles
 * Body: { roleId: string }  — assign a role to the team. Requires teams:assign.
 * All current and future team members inherit this role's permissions.
 */
async function assignHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teamId = teamIdFromPath(req)

  let body: { roleId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const roleId = body.roleId?.trim()
  if (!roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 })

  const ok = await assignRoleToTeam(ctx.organizationId, teamId, roleId)
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to assign role (invalid team or role)" },
      { status: 400 },
    )
  }

  await logAuthEvent({
    action: "rbac.team_role_assigned",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "team",
    resourceId: teamId,
    metadata: { roleId },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true }, { status: 201 })
}

/**
 * DELETE /api/v1/auth/teams/[teamId]/roles
 * Body: { roleId: string }  — remove a role from the team. Requires teams:assign.
 */
async function removeHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teamId = teamIdFromPath(req)

  let body: { roleId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const roleId = body.roleId?.trim()
  if (!roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 })

  const ok = await removeRoleFromTeam(ctx.organizationId, teamId, roleId)
  if (!ok) return NextResponse.json({ error: "Failed to remove role from team" }, { status: 400 })

  await logAuthEvent({
    action: "rbac.team_role_removed",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "team",
    resourceId: teamId,
    metadata: { roleId },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
}

export const POST = withAuth(assignHandler, { requireAll: ["teams:assign"] })
export const DELETE = withAuth(removeHandler, { requireAll: ["teams:assign"] })
