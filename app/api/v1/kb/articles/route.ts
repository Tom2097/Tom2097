import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createArticle, listArticles, validateArticle } from "@/lib/kb/engine"
import { ARTICLE_STATUSES, type ArticleInput, type ArticleStatus, type ListArticlesOptions } from "@/lib/kb/types"

/** GET /api/v1/kb/articles — list. Requires kb:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const statusParam = sp.get("status")
    const opts: ListArticlesOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      status: statusParam && ARTICLE_STATUSES.includes(statusParam as ArticleStatus) ? (statusParam as ArticleStatus) : undefined,
      categoryId: sp.get("categoryId") ?? undefined,
      tag: sp.get("tag") ?? undefined,
      search: sp.get("search") ?? undefined,
    }
    try {
      return NextResponse.json(await listArticles(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list articles"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:read"] },
)

/** POST /api/v1/kb/articles — create. Requires kb:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateArticle(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    try {
      const article = await createArticle(organizationId, userId, body as unknown as ArticleInput)
      await logAuthEvent({
        action: article.status === "published" ? "kb.article_published" : "kb.article_created",
        userId,
        organizationId,
        resourceType: "kb_article",
        resourceId: article.id,
        metadata: { title: article.title, slug: article.slug, status: article.status },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ article }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create article"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:write"] },
)

export { list as GET, create as POST }
