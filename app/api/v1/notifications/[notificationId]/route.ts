import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { deleteNotification, markRead } from "@/lib/notifications/engine"

/**
 * PATCH /api/v1/notifications/[notificationId]
 * Mark one of the caller's own notifications read. Scoped to org + user, so
 * an id that isn't the caller's simply no-ops (updated: false) rather than
 * leaking whether it exists.
 */
const markOneRead = withAuth(async (_req: NextRequest, { organizationId, userId, params }) => {
  const notificationId = params.notificationId
  if (!notificationId) {
    return NextResponse.json({ error: "notificationId is required" }, { status: 400 })
  }

  try {
    const updated = await markRead(organizationId, userId, notificationId)
    return NextResponse.json({ updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to mark notification read"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

/**
 * DELETE /api/v1/notifications/[notificationId]
 * Remove one of the caller's own notifications.
 */
const removeOne = withAuth(async (_req: NextRequest, { organizationId, userId, params }) => {
  const notificationId = params.notificationId
  if (!notificationId) {
    return NextResponse.json({ error: "notificationId is required" }, { status: 400 })
  }

  try {
    const deleted = await deleteNotification(organizationId, userId, notificationId)
    return NextResponse.json({ deleted })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to delete notification"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

export { markOneRead as PATCH, removeOne as DELETE }
