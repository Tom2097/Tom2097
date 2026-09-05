import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import {
  denyImpersonationConsent,
  grantImpersonationConsent,
  listPendingImpersonationRequests,
} from "@/lib/auth/impersonation"

// Lets the target of a pending impersonation request see it and grant/deny
// consent before the admin's session can actually begin (see
// lib/auth/impersonation.ts's startImpersonation). grant/denyImpersonationConsent
// each verify the caller is the session's target_user_id, so this is safe as
// a plain authenticated (non-admin) route.
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const requests = await listPendingImpersonationRequests(user.id)
    return NextResponse.json({ requests })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser()
    const { sessionId, approve = true } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const result = approve
      ? await grantImpersonationConsent(sessionId)
      : await denyImpersonationConsent(sessionId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
