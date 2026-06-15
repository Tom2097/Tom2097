import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { recordArticleView } from "@/lib/kb/engine"

/** Extract id from /api/v1/kb/articles/:id/view. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("articles")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** POST — record a view (atomic increment). Requires kb:read. */
const view = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await recordArticleView(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to record view"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:read"] },
)

export { view as POST }
