import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { hasPermission } from "@/lib/auth/rbac"
import { addComment, listComments } from "@/lib/feedback/engine"

/** Extract the feedback id from /api/v1/feedback/:id/comments. */
function feedbackIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("feedback")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * GET /api/v1/feedback/:id/comments
 * List comments. Internal notes are only returned to users with feedback:manage.
 * Requires feedback:read.
 */
const get = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = feedbackIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const canManage = await hasPermission(userId, "feedback:manage")
      const comments = await listComments(organizationId, id, canManage)
      return NextResponse.json({ comments })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list comments"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["feedback:read"] },
)

/**
 * POST /api/v1/feedback/:id/comments
 * Add a comment. Posting an internal note requires feedback:manage; otherwise
 * any member with feedback:submit may comment.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = feedbackIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: { body?: string; is_internal?: boolean }
    try {
      body = (await req.json()) as { body?: string; is_internal?: boolean }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body.body || typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "body is required" }, { status: 400 })
    }
    if (body.body.length > 5000) {
      return NextResponse.json({ error: "comment too long (max 5000)" }, { status: 400 })
    }

    const wantsInternal = body.is_internal === true
    if (wantsInternal) {
      const canManage = await hasPermission(userId, "feedback:manage")
      if (!canManage) {
        return NextResponse.json(
          { error: "internal comments require feedback:manage" },
          { status: 403 },
        )
      }
    }

    try {
      const comment = await addComment(organizationId, id, userId, body.body, wantsInternal)

      await logAuthEvent({
        action: "feedback.commented",
        userId,
        organizationId,
        resourceType: "feedback",
        resourceId: id,
        metadata: { internal: wantsInternal },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ comment }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to add comment"
      const status = message === "feedback not found" ? 404 : 400
      return NextResponse.json({ error: message }, { status })
    }
  },
  { requireAll: ["feedback:submit"] },
)

export { get as GET, create as POST }
