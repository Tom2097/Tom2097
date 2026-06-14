import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteDocument, getDocument, updateDocument } from "@/lib/documents/engine"
import type { DocumentUpdate } from "@/lib/documents/types"

function idFromUrl(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const i = parts.indexOf("documents")
  return i >= 0 ? (parts[i + 1] ?? "") : ""
}

/** GET /api/v1/documents/:id — fetch metadata. Requires documents:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const documentId = idFromUrl(req)
    if (!documentId) return NextResponse.json({ error: "missing document id" }, { status: 400 })
    try {
      const doc = await getDocument(organizationId, documentId)
      if (!doc) return NextResponse.json({ error: "document not found" }, { status: 404 })
      return NextResponse.json({ document: doc })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:read"] },
)

/** PATCH /api/v1/documents/:id — update metadata. Requires documents:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const documentId = idFromUrl(req)
    if (!documentId) return NextResponse.json({ error: "missing document id" }, { status: 400 })

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
      const doc = await updateDocument(organizationId, documentId, body as unknown as DocumentUpdate)
      if (!doc) return NextResponse.json({ error: "document not found" }, { status: 404 })

      await logAuthEvent({
        action: "document.updated",
        userId,
        organizationId,
        resourceType: "document",
        resourceId: documentId,
        metadata: { fields: Object.keys(body) },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ document: doc })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:write"] },
)

/** DELETE /api/v1/documents/:id — delete document + storage objects. Requires documents:delete. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const documentId = idFromUrl(req)
    if (!documentId) return NextResponse.json({ error: "missing document id" }, { status: 400 })
    try {
      const ok = await deleteDocument(organizationId, documentId)
      if (!ok) return NextResponse.json({ error: "document not found" }, { status: 404 })

      await logAuthEvent({
        action: "document.deleted",
        userId,
        organizationId,
        resourceType: "document",
        resourceId: documentId,
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:delete"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
