import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { grantImpersonationConsent } from "@/lib/auth/impersonation"

// Lets the target of a pending impersonation request grant consent before
// the admin's session can actually begin (see lib/auth/impersonation.ts's
// startImpersonation / grantImpersonationConsent). grantImpersonationConsent
// itself verifies the caller is the session's target_user_id, so this is
// safe as a plain authenticated (non-admin) route.
export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser()
    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const result = await grantImpersonationConsent(sessionId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
