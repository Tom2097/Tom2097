import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteCategory, getCategory, updateCategory } from "@/lib/kb/engine"
import type { CategoryUpdateInput } from "@/lib/kb/types"

/** Extract id from /api/v1/kb/categories/:id. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("categories")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires kb:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const category = await getCategory(organizationId, id)
      if (!category) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ category })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch category"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:read"] },
)

/** PATCH — edit. Requires kb:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: CategoryUpdateInput
    try {
      body = (await req.json()) as CategoryUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const updated = await updateCategory(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "kb.category_updated",
        userId,
        organizationId,
        resourceType: "kb_category",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ category: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update category"
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
      const ok = await deleteCategory(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "kb.category_deleted",
        userId,
        organizationId,
        resourceType: "kb_category",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete category"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["kb:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
