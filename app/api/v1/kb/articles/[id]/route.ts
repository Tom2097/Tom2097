import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteArticle, getArticle, updateArticle } from "@/lib/kb/engine"
import type { ArticleUpdateInput } from "@/lib/kb/types"

/** Extract id from /api/v1/kb/articles/:id[/...]. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("articles")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires kb:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const article = await getArticle(organizationId, id)
      if (!article) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ article })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch article"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:read"] },
)

/** PATCH — edit / publish / unpublish. Requires kb:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: ArticleUpdateInput
    try {
      body = (await req.json()) as ArticleUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const result = await updateArticle(organizationId, id, body)
      if (!result) return NextResponse.json({ error: "not found" }, { status: 404 })
      const action =
        result.statusChange === "published"
          ? "kb.article_published"
          : result.statusChange === "unpublished"
            ? "kb.article_unpublished"
            : "kb.article_updated"
      await logAuthEvent({
        action,
        userId,
        organizationId,
        resourceType: "kb_article",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}), status: result.article.status },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ article: result.article })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update article"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:write"] },
)

/** DELETE — remove. Requires kb:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteArticle(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "kb.article_deleted",
        userId,
        organizationId,
        resourceType: "kb_article",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete article"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
