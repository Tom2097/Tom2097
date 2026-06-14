import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createUpload, listDocuments, validateUpload } from "@/lib/documents/engine"
import type { CreateUploadInput, DocumentStatus, ListDocumentsOptions } from "@/lib/documents/types"

/**
 * GET /api/v1/documents
 * List documents for the caller's org. Requires documents:read.
 *
 * Query: ?limit=&offset=&folder_id=&root=true&status=&tag=&search=
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? 20), 1), 100)
    const offset = Math.max(Number(sp.get("offset") ?? 0), 0)
    const str = (k: string) => {
      const v = sp.get(k)
      return v && v.trim() ? v.trim() : null
    }

    const opts: ListDocumentsOptions = { limit, offset }
    if (sp.get("root") === "true") opts.folderId = null
    else if (str("folder_id")) opts.folderId = str("folder_id") as string
    const status = str("status")
    if (status) opts.status = status as DocumentStatus
    const tag = str("tag")
    if (tag) opts.tag = tag
    const search = str("search")
    if (search) opts.search = search

    try {
      const result = await listDocuments(organizationId, opts)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list documents"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:read"] },
)

/**
 * POST /api/v1/documents
 * Begin an upload — returns a signed upload URL + document id. Requires documents:write.
 * The client PUTs bytes to the signed URL, then calls POST /api/v1/documents/:id/confirm.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const invalid = validateUpload(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const ticket = await createUpload(organizationId, userId, body as unknown as CreateUploadInput)

      await logAuthEvent({
        action: "document.uploaded",
        userId,
        organizationId,
        resourceType: "document",
        resourceId: ticket.documentId,
        metadata: { storagePath: ticket.storagePath },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({ upload: ticket }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create upload"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:write"] },
)

export { list as GET, create as POST }
