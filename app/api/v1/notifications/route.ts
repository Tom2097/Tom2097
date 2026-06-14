import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import {
  broadcast,
  createNotification,
  listNotifications,
  validateNotification,
} from "@/lib/notifications/engine"
import type { BroadcastInput, NotificationInput } from "@/lib/notifications/types"

/**
 * GET /api/v1/notifications
 * List the authenticated user's own notifications (org-scoped). Any
 * authenticated member may read their own inbox — no extra permission needed.
 *
 * Query: ?limit=&offset=&unread=true&category=
 */
const list = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const sp = req.nextUrl.searchParams
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 20), 1), 100)
  const offset = Math.max(Number(sp.get("offset") ?? 0), 0)
  const unreadOnly = sp.get("unread") === "true"
  const category = sp.get("category")

  try {
    const result = await listNotifications(organizationId, userId, {
      limit,
      offset,
      unreadOnly,
      category: category && category.trim() ? category.trim() : null,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to list notifications"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

/**
 * POST /api/v1/notifications
 * Create a notification for one recipient, or broadcast to many.
 * Requires notifications:send.
 *
 * Single:    { user_id, title, ... }
 * Broadcast: { broadcast: true, title, ..., user_ids?: string[] }
 *            (omit user_ids to target all org members)
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const isBroadcast = body.broadcast === true || Array.isArray(body.user_ids)

    try {
      if (isBroadcast) {
        const invalid = validateNotification(body, false)
        if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

        const userIds = Array.isArray(body.user_ids)
          ? (body.user_ids as unknown[]).filter((u): u is string => typeof u === "string")
          : undefined

        const { delivered } = await broadcast(organizationId, body as BroadcastInput, userIds)

        await logAuthEvent({
          action: "notification.broadcast",
          userId,
          organizationId,
          resourceType: "notification",
          metadata: { delivered, category: body.category ?? "general", targeted: userIds?.length ?? "all" },
          ipAddress: getClientIp(req.headers),
        })

        return NextResponse.json({ delivered }, { status: 201 })
      }

      const invalid = validateNotification(body, true)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

      const created = await createNotification(organizationId, body as unknown as NotificationInput)

      await logAuthEvent({
        action: "notification.created",
        userId,
        organizationId,
        resourceType: "notification",
        resourceId: created?.id,
        metadata: { recipient: (body as { user_id: string }).user_id, suppressed: created === null },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ notification: created, suppressed: created === null }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create notification"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["notifications:send"] },
)

export { list as GET, create as POST }
