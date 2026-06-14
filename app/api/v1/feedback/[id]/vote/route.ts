import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { toggleVote } from "@/lib/feedback/engine"

/** Extract the feedback id from /api/v1/feedback/:id/vote. */
function feedbackIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("feedback")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * POST /api/v1/feedback/:id/vote
 * Toggle the caller's upvote on a feedback item. Requires feedback:read
 * (any member who can see feedback may vote on it).
 */
const vote = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = feedbackIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    try {
      const result = await toggleVote(organizationId, id, userId)

      await logAuthEvent({
        action: result.voted ? "feedback.voted" : "feedback.unvoted",
        userId,
        organizationId,
        resourceType: "feedback",
        resourceId: id,
        metadata: { vote_count: result.voteCount },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to vote"
      const status = message === "feedback not found" ? 404 : 400
      return NextResponse.json({ error: message }, { status })
    }
  },
  { requireAll: ["feedback:read"] },
)

export { vote as POST }
