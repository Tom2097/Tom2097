import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { submitArticleFeedback } from "@/lib/kb/engine"
import type { ArticleFeedbackInput } from "@/lib/kb/types"

/** Extract id from /api/v1/kb/articles/:id/feedback. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("articles")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** POST — submit helpful/not-helpful feedback (one per user). Requires kb:read. */
const submit = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: ArticleFeedbackInput
    try {
      body = (await req.json()) as ArticleFeedbackInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (typeof body?.is_helpful !== "boolean") {
      return NextResponse.json({ error: "is_helpful (boolean) is required" }, { status: 400 })
    }
    try {
      const feedback = await submitArticleFeedback(organizationId, userId, id, body)
      if (!feedback) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "kb.article_feedback",
        userId,
        organizationId,
        resourceType: "kb_article",
        resourceId: id,
        metadata: { isHelpful: feedback.is_helpful },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ feedback }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to submit feedback"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:read"] },
)

export { submit as POST }
