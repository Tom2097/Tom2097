import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { archiveDocument, publishDocument } from "@/lib/legal/engine"

/** Extract id from /api/v1/legal/documents/:id/publish. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("documents")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * POST /api/v1/legal/documents/:id/publish — publish (default) or archive a
 * document version. Body: { action?: "publish" | "archive" }. Requires legal:manage.
 */
const post = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let action: "publish" | "archive" = "publish"
    try {
      const body = (await req.json()) as { action?: string }
      if (body?.action === "archive") action = "archive"
    } catch {
      // empty body → default publish
    }

    try {
      const document = action === "archive" ? await archiveDocument(organizationId, id) : await publishDocument(organizationId, id)
      if (!document) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: action === "archive" ? "legal.document_archived" : "legal.document_published",
        userId,
        organizationId,
        resourceType: "legal_document",
        resourceId: id,
        metadata: { doc_type: document.doc_type, version: document.version, status: document.status },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ document })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to publish document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:manage"] },
)

export { post as POST }
