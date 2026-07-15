import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import {
  requestElevation,
  approveElevation,
  denyElevation,
  revokeElevation,
  listElevationRequests,
  getMyElevationStatus,
} from "@/lib/auth/jit-access"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = await request.json()

    switch (body.action) {
      case "request": {
        const result = await requestElevation(body.role, body.reason, body.durationMinutes)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ request: result.request })
      }
      case "approve": {
        const result = await approveElevation(body.requestId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }
      case "deny": {
        const result = await denyElevation(body.requestId, body.reason)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }
      case "revoke": {
        // Defaults to revoking the caller's own active elevation; an explicit
        // userId/organizationId lets a platform owner revoke someone else's.
        const targetUserId = body.userId || user.id
        const organizationId = body.organizationId || await getOrganizationId(user.id)
        const result = await revokeElevation(targetUserId, organizationId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET() {
  try {
    await getAuthenticatedUser()
    const [status, requests] = await Promise.all([
      getMyElevationStatus(),
      listElevationRequests(),
    ])
    return NextResponse.json({ ...status, requests })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
