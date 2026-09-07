import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createCategory, listCategories, validateCategory } from "@/lib/kb/engine"
import type { CategoryInput, ListCategoriesOptions } from "@/lib/kb/types"

/** GET /api/v1/kb/categories — list. Requires kb:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const parent = sp.get("parentId")
    const opts: ListCategoriesOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 100), 1), 200),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      parentId: parent === null ? undefined : parent === "null" ? null : parent,
    }
    try {
      return NextResponse.json(await listCategories(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list categories"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:read"] },
)

/** POST /api/v1/kb/categories — create. Requires kb:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateCategory(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    try {
      const category = await createCategory(organizationId, userId, body as unknown as CategoryInput)
      await logAuthEvent({
        action: "kb.category_created",
        userId,
        organizationId,
        resourceType: "kb_category",
        resourceId: category.id,
        metadata: { name: category.name, slug: category.slug },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ category }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create category"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:write"] },
)

export { list as GET, create as POST }
