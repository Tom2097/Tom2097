import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteDocument, getDocument, updateDocument } from "@/lib/legal/engine"
import type { LegalDocumentUpdateInput } from "@/lib/legal/types"

/** Extract id from /api/v1/legal/documents/:id[/...]. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("documents")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires legal:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const document = await getDocument(organizationId, id)
      if (!document) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ document })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:read"] },
)

/** PATCH — edit draft. Requires legal:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: LegalDocumentUpdateInput
    try {
      body = (await req.json()) as LegalDocumentUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const document = await updateDocument(organizationId, id, body)
      if (!document) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "legal.document_updated",
        userId,
        organizationId,
        resourceType: "legal_document",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ document })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:write"] },
)

/** DELETE — remove. Requires legal:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteDocument(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "legal.document_deleted",
        userId,
        organizationId,
        resourceType: "legal_document",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
