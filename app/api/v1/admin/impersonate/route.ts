import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { checkIpAllowlist } from "@/lib/auth/ip-allowlist"
import { startImpersonation, endImpersonation, getActiveImpersonationSession, listActiveImpersonations } from "@/lib/auth/impersonation"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const ipCheck = await checkIpAllowlist(request)
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    
    if (body.action === "start") {
      const result = await startImpersonation(body.targetUserId, body.reason || "Admin support")
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ session: result.session })
    }
    
    if (body.action === "end") {
      const result = await endImpersonation(body.sessionId)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const ipCheck = await checkIpAllowlist(request)
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sessions = await listActiveImpersonations()
    return NextResponse.json({ sessions })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
