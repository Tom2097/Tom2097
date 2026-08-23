import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { markAllRead } from "@/lib/notifications/engine"

/**
 * POST /api/v1/notifications/read-all
 * Mark all of the caller's unread notifications read in one call — backs the
 * notification bell's "Mark all read" action.
 */
const readAll = withAuth(async (_req: NextRequest, { organizationId, userId }) => {
  try {
    const updated = await markAllRead(organizationId, userId)
    return NextResponse.json({ updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to mark all notifications read"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

export { readAll as POST }
