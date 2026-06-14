import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { deleteNotification, markRead } from "@/lib/notifications/engine"

/**
 * PATCH /api/v1/notifications/:id   → mark the notification read
 * DELETE /api/v1/notifications/:id  → delete the notification
 *
 * Both are scoped to the authenticated user, so ids belonging to another user
 * or tenant simply no-op (404) rather than leak existence.
 */
function getId(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const id = parts[parts.length - 1]
  return id && id !== "notifications" ? id : null
}

const patch = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const id = getId(req)
  if (!id) return NextResponse.json({ error: "missing notification id" }, { status: 400 })
  try {
    const ok = await markRead(organizationId, userId, id)
    if (!ok) return NextResponse.json({ error: "not found or already read" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to mark read"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

const remove = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const id = getId(req)
  if (!id) return NextResponse.json({ error: "missing notification id" }, { status: 400 })
  try {
    const ok = await deleteNotification(organizationId, userId, id)
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to delete"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

export { patch as PATCH, remove as DELETE }
