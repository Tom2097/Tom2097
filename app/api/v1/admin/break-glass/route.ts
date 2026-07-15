import { NextResponse, type NextRequest } from "next/server"
import { requestBreakGlassAccess, endBreakGlassSession, getActiveBreakGlassSession, listBreakGlassSessions } from "@/lib/auth/break-glass"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"

/**
 * POST: Request break-glass access, or revoke an existing session.
 * Body: { action: "activate", reason, duration? } | { action: "revoke", sessionId }
 * Also accepts the legacy admin-platform shape { reason, duration } (no action) as "activate".
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const action = body.action ?? "activate"

  if (action === "revoke") {
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }
    const result = await endBreakGlassSession(body.sessionId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  const result = await requestBreakGlassAccess(body.reason, body.duration)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}

/**
 * DELETE: End the caller's own active break-glass session.
 */
export async function DELETE() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await endBreakGlassSession()

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

/**
 * GET: List recent break-glass sessions (any status), plus the caller's
 * own active session for the admin-platform single-session view.
 */
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [sessions, mySession] = await Promise.all([
    listBreakGlassSessions(),
    getActiveBreakGlassSession(),
  ])

  return NextResponse.json({ sessions, active: !!mySession, session: mySession })
}
