import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { markAllRead } from "@/lib/notifications/engine"

/**
 * POST /api/v1/notifications/read-all
 * Mark all of the authenticated user's unread notifications as read.
 */
const handler = withAuth(async (_req, { organizationId, userId }) => {
  try {
    const updated = await markAllRead(organizationId, userId)
    return NextResponse.json({ updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to mark all read"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

export { handler as POST }
