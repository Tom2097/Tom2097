import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { listConsents, recordConsent } from "@/lib/legal/engine"
import { LEGAL_DOC_TYPES, type ConsentInput, type LegalDocType, type ListConsentsOptions } from "@/lib/legal/types"

/** GET /api/v1/legal/consents — list consent records. Requires legal:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const docTypeParam = sp.get("docType")
    const opts: ListConsentsOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 200),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      documentId: sp.get("documentId") ?? undefined,
      userId: sp.get("userId") ?? undefined,
      docType: docTypeParam && LEGAL_DOC_TYPES.includes(docTypeParam as LegalDocType) ? (docTypeParam as LegalDocType) : undefined,
    }
    try {
      return NextResponse.json(await listConsents(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list consents"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:read"] },
)

/**
 * POST /api/v1/legal/consents — record a consent decision for the authenticated
 * user, pinned to the document's current version. Requires legal:read (any
 * member can record their own consent).
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: ConsentInput
    try {
      body = (await req.json()) as ConsentInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const consent = await recordConsent(organizationId, body, {
        userId,
        ipAddress: getClientIp(req.headers),
        userAgent: req.headers.get("user-agent"),
      })
      await logAuthEvent({
        action: "legal.consent_recorded",
        userId,
        organizationId,
        resourceType: "legal_consent",
        resourceId: consent.id,
        metadata: { document_id: consent.document_id, doc_type: consent.doc_type, version: consent.document_version, action: consent.action },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ consent }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to record consent"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:read"] },
)

export { list as GET, create as POST }
