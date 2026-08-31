import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { listTeams, createTeam } from "@/lib/auth/teams"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/** GET /api/v1/auth/teams — list teams in the org. Requires teams:read. */
async function listHandler(_req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const teams = await listTeams(ctx.organizationId)
  return NextResponse.json({ teams })
}

/** POST /api/v1/auth/teams — create a team. Requires teams:write. */
async function createHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  let body: { name?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: "Team name is required" }, { status: 400 })

  const team = await createTeam(ctx.organizationId, name, body.description ?? null, ctx.userId)
  if (!team) {
    return NextResponse.json({ error: "Failed to create team (name may already exist)" }, { status: 409 })
  }

  await logAuthEvent({
    action: "rbac.team_created",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "team",
    resourceId: team.id,
    metadata: { name },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ team }, { status: 201 })
}

export const GET = withAuth(listHandler, { requireAll: ["teams:read"] })
export const POST = withAuth(createHandler, { requireAll: ["teams:write"] })
