import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { autocomplete } from "@/lib/search/query"

/**
 * Autocomplete API (Module #4).
 * GET /api/v1/search/autocomplete?q=...&limit=...
 *
 * Returns lightweight, tenant-scoped title suggestions for type-ahead UIs.
 * Uses full-text-leaning matching for fast, literal prefix results.
 * organizationId comes from the auth context to preserve tenant isolation.
 */
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = req.nextUrl

  const prefix = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim()
  if (!prefix) {
    return NextResponse.json({ query: "", suggestions: [] })
  }

  const limitParam = Number.parseInt(searchParams.get("limit") ?? "8", 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 8

  const suggestions = await autocomplete(ctx.organizationId, prefix, limit)

  return NextResponse.json({ query: prefix, suggestions })
})
