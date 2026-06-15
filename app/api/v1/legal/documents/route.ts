import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createDocument, listDocuments, validateDocument } from "@/lib/legal/engine"
import {
  LEGAL_DOC_STATUSES,
  LEGAL_DOC_TYPES,
  type LegalDocStatus,
  type LegalDocType,
  type LegalDocumentInput,
  type ListDocumentsOptions,
} from "@/lib/legal/types"

/** GET /api/v1/legal/documents — list. Requires legal:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const docTypeParam = sp.get("docType")
    const statusParam = sp.get("status")
    const opts: ListDocumentsOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      docType: docTypeParam && LEGAL_DOC_TYPES.includes(docTypeParam as LegalDocType) ? (docTypeParam as LegalDocType) : undefined,
      status: statusParam && LEGAL_DOC_STATUSES.includes(statusParam as LegalDocStatus) ? (statusParam as LegalDocStatus) : undefined,
    }
    try {
      return NextResponse.json(await listDocuments(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list documents"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:read"] },
)

/** POST /api/v1/legal/documents — create draft. Requires legal:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateDocument(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    try {
      const document = await createDocument(organizationId, userId, body as unknown as LegalDocumentInput)
      await logAuthEvent({
        action: "legal.document_created",
        userId,
        organizationId,
        resourceType: "legal_document",
        resourceId: document.id,
        metadata: { doc_type: document.doc_type, version: document.version, title: document.title },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ document }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create document"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:write"] },
)

export { list as GET, create as POST }
