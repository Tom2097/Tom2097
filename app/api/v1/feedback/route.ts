import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { listFeedback, submitFeedback, validateFeedback } from "@/lib/feedback/engine"
import type {
  FeedbackInput,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackType,
  ListFeedbackOptions,
} from "@/lib/feedback/types"

/**
 * GET /api/v1/feedback
 * List feedback for the caller's org. Requires feedback:read.
 *
 * Query: ?limit=&offset=&status=&type=&priority=&category=&assigned_to=
 *        &mine=true&search=&sort=recent|votes
 */
const list = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const sp = req.nextUrl.searchParams
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? 20), 1), 100)
    const offset = Math.max(Number(sp.get("offset") ?? 0), 0)
    const str = (k: string) => {
      const v = sp.get(k)
      return v && v.trim() ? v.trim() : null
    }

    const opts: ListFeedbackOptions = {
      limit,
      offset,
      status: str("status") as FeedbackStatus | null,
      type: str("type") as FeedbackType | null,
      priority: str("priority") as FeedbackPriority | null,
      category: str("category"),
      assignedTo: str("assigned_to"),
      submittedBy: sp.get("mine") === "true" ? userId : str("submitted_by"),
      search: str("search"),
      sort: sp.get("sort") === "votes" ? "votes" : "recent",
    }

    try {
      const result = await listFeedback(organizationId, opts)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list feedback"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["feedback:read"] },
)

/**
 * POST /api/v1/feedback
 * Submit feedback. Requires feedback:submit.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const invalid = validateFeedback(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const created = await submitFeedback(organizationId, userId, body as unknown as FeedbackInput)

      await logAuthEvent({
        action: "feedback.created",
        userId,
        organizationId,
        resourceType: "feedback",
        resourceId: created.id,
        metadata: { type: created.type, category: created.category },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ feedback: created }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to submit feedback"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["feedback:submit"] },
)

export { list as GET, create as POST }
