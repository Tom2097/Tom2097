import { NextResponse } from "next/server"
import { requestBreakGlassAccess, endBreakGlassSession } from "@/lib/auth/break-glass"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"

/**
 * POST: Request break-glass access
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { reason, duration } = await request.json()
  const result = await requestBreakGlassAccess(reason, duration)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

/**
 * DELETE: End break-glass session
 */
export async function DELETE() {
  const result = await endBreakGlassSession()

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

/**
 * GET: Check active break-glass session
 */
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const session = await getActiveBreakGlassSession()
  return NextResponse.json({ active: !!session, session })
}