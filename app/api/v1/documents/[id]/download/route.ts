import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { getDownloadUrl } from "@/lib/documents/engine"

function idFromUrl(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const i = parts.indexOf("documents")
  return i >= 0 ? (parts[i + 1] ?? "") : ""
}

/**
 * GET /api/v1/documents/:id/download — mint a short-lived signed download URL.
 * Requires documents:read. Query: ?version=<n> (defaults to current).
 */
const download = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const documentId = idFromUrl(req)
    if (!documentId) return NextResponse.json({ error: "missing document id" }, { status: 400 })

    const versionParam = req.nextUrl.searchParams.get("version")
    const version = versionParam ? Number(versionParam) : undefined
    if (version !== undefined && (!Number.isInteger(version) || version < 1)) {
      return NextResponse.json({ error: "invalid version" }, { status: 400 })
    }

    try {
      const result = await getDownloadUrl(organizationId, documentId, version)
      if (!result) return NextResponse.json({ error: "document not found" }, { status: 404 })

      await logAuthEvent({
        action: "document.downloaded",
        userId,
        organizationId,
        resourceType: "document",
        resourceId: documentId,
        metadata: { version: version ?? result.document.current_version },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json({
        url: result.url,
        name: result.document.name,
        mimeType: result.document.mime_type,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create download url"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:read"] },
)

export { download as GET }
