import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { confirmVersion, createVersionUpload, listVersions } from "@/lib/documents/engine"

function idFromUrl(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const i = parts.indexOf("documents")
  return i >= 0 ? (parts[i + 1] ?? "") : ""
}

/** GET /api/v1/documents/:id/versions — list version history. Requires documents:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const documentId = idFromUrl(req)
    if (!documentId) return NextResponse.json({ error: "missing document id" }, { status: 400 })
    try {
      const versions = await listVersions(organizationId, documentId)
      return NextResponse.json({ versions })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list versions"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:read"] },
)

/**
 * POST /api/v1/documents/:id/versions — begin a new version upload, or confirm one.
 * Requires documents:write.
 *  - Begin:   { fileName, mimeType?, sizeBytes? }            -> { upload }
 *  - Confirm: { confirm: true, version, sizeBytes? }         -> { document }
 */
const create = withAuth(
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
      if (body.confirm === true) {
        const version = Number(body.version)
        if (!Number.isInteger(version) || version < 1) {
          return NextResponse.json({ error: "valid version required" }, { status: 400 })
        }
        const sizeBytes = typeof body.sizeBytes === "number" ? (body.sizeBytes as number) : undefined
        const doc = await confirmVersion(organizationId, documentId, version, sizeBytes)
        if (!doc) return NextResponse.json({ error: "document not found" }, { status: 404 })

        await logAuthEvent({
          action: "document.version_added",
          userId,
          organizationId,
          resourceType: "document",
          resourceId: documentId,
          metadata: { version },
          ipAddress: getClientIp(req.headers),
        })

        return NextResponse.json({ document: doc })
      }

      const fileName = typeof body.fileName === "string" ? body.fileName : ""
      if (!fileName.trim()) return NextResponse.json({ error: "fileName required" }, { status: 400 })
      const mimeType = typeof body.mimeType === "string" ? body.mimeType : undefined
      const sizeBytes = typeof body.sizeBytes === "number" ? (body.sizeBytes as number) : undefined

      const ticket = await createVersionUpload(organizationId, documentId, userId, fileName, mimeType, sizeBytes)
      return NextResponse.json({ upload: ticket }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create version"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:write"] },
)

export { list as GET, create as POST }
