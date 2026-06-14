import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteFeedback, getFeedback, updateFeedback } from "@/lib/feedback/engine"
import type { FeedbackUpdate } from "@/lib/feedback/types"

/** Extract the feedback id from /api/v1/feedback/:id[/...]. */
function feedbackIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("feedback")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * GET /api/v1/feedback/:id  — fetch one item. Requires feedback:read.
 */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = feedbackIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const feedback = await getFeedback(organizationId, id)
      if (!feedback) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ feedback })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch feedback"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["feedback:read"] },
)

/**
 * PATCH /api/v1/feedback/:id  — triage: status/priority/assignee/type/etc.
 * Requires feedback:manage.
 */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = feedbackIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: FeedbackUpdate
    try {
      body = (await req.json()) as FeedbackUpdate
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
      const before = await getFeedback(organizationId, id)
      if (!before) return NextResponse.json({ error: "not found" }, { status: 404 })

      const updated = await updateFeedback(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })

      // Emit specific audit events for the meaningful transitions.
      if (body.status !== undefined && body.status !== before.status) {
        await logAuthEvent({
          action: "feedback.status_changed",
          userId,
          organizationId,
          resourceType: "feedback",
          resourceId: id,
          metadata: { from: before.status, to: updated.status },
          ipAddress: getClientIp(req.headers),
        })
      }
      if (body.assigned_to !== undefined && body.assigned_to !== before.assigned_to) {
        await logAuthEvent({
          action: "feedback.assigned",
          userId,
          organizationId,
          resourceType: "feedback",
          resourceId: id,
          metadata: { assigned_to: updated.assigned_to },
          ipAddress: getClientIp(req.headers),
        })
      }
      await logAuthEvent({
        action: "feedback.updated",
        userId,
        organizationId,
        resourceType: "feedback",
        resourceId: id,
        metadata: { fields: Object.keys(body) },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ feedback: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update feedback"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["feedback:manage"] },
)

/**
 * DELETE /api/v1/feedback/:id — remove feedback. Requires feedback:manage.
 */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = feedbackIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteFeedback(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })

      await logAuthEvent({
        action: "feedback.deleted",
        userId,
        organizationId,
        resourceType: "feedback",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete feedback"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["feedback:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
