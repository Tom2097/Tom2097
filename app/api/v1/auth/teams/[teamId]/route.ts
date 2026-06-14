import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { getTeam, updateTeam, deleteTeam } from "@/lib/auth/teams"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/** Extract the [teamId] segment from /api/v1/auth/teams/{teamId}. */
function teamIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  return parts[parts.indexOf("teams") + 1] ?? ""
}

/** GET /api/v1/auth/teams/[teamId] — team with members and role ids. Requires teams:read. */
async function getHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teamId = teamIdFromPath(req)
  const team = await getTeam(ctx.organizationId, teamId)
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
  return NextResponse.json({ team })
}

/** PATCH /api/v1/auth/teams/[teamId] — update name/description. Requires teams:write. */
async function patchHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teamId = teamIdFromPath(req)

  let body: { name?: string; description?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const team = await updateTeam(ctx.organizationId, teamId, {
    name: body.name?.trim(),
    description: body.description,
  })
  if (!team) return NextResponse.json({ error: "Team not found or update failed" }, { status: 404 })

  await logAuthEvent({
    action: "rbac.team_updated",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "team",
    resourceId: teamId,
    metadata: { updates: body },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ team })
}

/** DELETE /api/v1/auth/teams/[teamId] — delete a team. Requires teams:delete. */
async function deleteHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teamId = teamIdFromPath(req)
  const ok = await deleteTeam(ctx.organizationId, teamId)
  if (!ok) return NextResponse.json({ error: "Team not found or delete failed" }, { status: 404 })

  await logAuthEvent({
    action: "rbac.team_deleted",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "team",
    resourceId: teamId,
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
}

export const GET = withAuth(getHandler, { requireAll: ["teams:read"] })
export const PATCH = withAuth(patchHandler, { requireAll: ["teams:write"] })
export const DELETE = withAuth(deleteHandler, { requireAll: ["teams:delete"] })
