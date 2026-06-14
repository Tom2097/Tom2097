import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { confirmUpload } from "@/lib/documents/engine"

function idFromUrl(req: NextRequest): string {
  // /api/v1/documents/<id>/confirm
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const i = parts.indexOf("documents")
  return i >= 0 ? (parts[i + 1] ?? "") : ""
}

/**
 * POST /api/v1/documents/:id/confirm
 * Mark an upload complete (status -> ready) and index for search. Requires documents:write.
 * Body: { sizeBytes?: number }
 */
const confirm = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const documentId = idFromUrl(req)
    if (!documentId) return NextResponse.json({ error: "missing document id" }, { status: 400 })

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      // body is optional
    }
    const sizeBytes = typeof body.sizeBytes === "number" ? (body.sizeBytes as number) : undefined

    try {
      const doc = await confirmUpload(organizationId, documentId, sizeBytes)
      if (!doc) return NextResponse.json({ error: "document not found" }, { status: 404 })
      return NextResponse.json({ document: doc })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to confirm upload"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["documents:write"] },
)

export { confirm as POST }
