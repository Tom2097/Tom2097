import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { searchWithFacets } from "@/lib/search/query"

/**
 * Search query API (Module #4).
 * GET /api/v1/search?q=...&type=...&limit=...&semanticWeight=...&rerank=...
 *
 * Returns tenant-scoped hybrid (full-text + semantic) results plus per
 * resource-type facet counts. organizationId comes from the auth context,
 * never the request, so results can never cross tenants.
 *
 * Any authenticated member of the tenant may search; results are already
 * constrained to the caller's organization.
 */
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = req.nextUrl

  const query = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim()
  if (!query) {
    return NextResponse.json({ query: "", hits: [], facets: [] })
  }

  const resourceType = searchParams.get("type") ?? undefined

  const limitParam = Number.parseInt(searchParams.get("limit") ?? "20", 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20

  const semanticParam = Number.parseFloat(searchParams.get("semanticWeight") ?? "")
  const semanticWeight =
    Number.isFinite(semanticParam) && semanticParam >= 0 && semanticParam <= 1 ? semanticParam : undefined

  const rerank = searchParams.get("rerank")
  const reranking = rerank === null ? undefined : rerank !== "false" && rerank !== "0"

  const { hits, facets } = await searchWithFacets({
    organizationId: ctx.organizationId,
    query,
    resourceType,
    limit,
    semanticWeight,
    reranking,
  })

  return NextResponse.json({ query, resourceType: resourceType ?? null, hits, facets })
})
