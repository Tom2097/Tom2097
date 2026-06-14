import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { addTeamMember, removeTeamMember } from "@/lib/auth/teams"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/** Extract the [teamId] segment from /api/v1/auth/teams/{teamId}/members. */
function teamIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  return parts[parts.indexOf("teams") + 1] ?? ""
}

/**
 * POST /api/v1/auth/teams/[teamId]/members
 * Body: { userId: string }  — add a member. Requires teams:write.
 */
async function addHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teamId = teamIdFromPath(req)

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const userId = body.userId?.trim()
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const ok = await addTeamMember(ctx.organizationId, teamId, userId, ctx.userId)
  if (!ok) return NextResponse.json({ error: "Failed to add member (invalid team)" }, { status: 400 })

  await logAuthEvent({
    action: "rbac.team_member_added",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "team",
    resourceId: teamId,
    metadata: { memberId: userId },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true }, { status: 201 })
}

/**
 * DELETE /api/v1/auth/teams/[teamId]/members
 * Body: { userId: string }  — remove a member. Requires teams:write.
 */
async function removeHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teamId = teamIdFromPath(req)

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const userId = body.userId?.trim()
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const ok = await removeTeamMember(ctx.organizationId, teamId, userId)
  if (!ok) return NextResponse.json({ error: "Failed to remove member" }, { status: 400 })

  await logAuthEvent({
    action: "rbac.team_member_removed",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "team",
    resourceId: teamId,
    metadata: { memberId: userId },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
}

export const POST = withAuth(addHandler, { requireAll: ["teams:write"] })
export const DELETE = withAuth(removeHandler, { requireAll: ["teams:write"] })
