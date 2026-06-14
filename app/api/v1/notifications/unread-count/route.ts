import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getUnreadCount } from "@/lib/notifications/engine"

/**
 * GET /api/v1/notifications/unread-count
 * Lightweight unread badge count for the authenticated user (org-scoped).
 */
const handler = withAuth(async (_req, { organizationId, userId }) => {
  try {
    const count = await getUnreadCount(organizationId, userId)
    return NextResponse.json({ count })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to get unread count"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

export { handler as GET }
