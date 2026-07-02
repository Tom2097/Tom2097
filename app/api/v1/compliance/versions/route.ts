import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  createDocumentVersion,
  getDocumentVersions,
  getDocumentVersion,
  diffVersions,
  restoreDocumentVersion,
  deleteOldVersions,
} from "@/lib/compliance/document-versioning"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const method = req.method

    if (method === "GET") {
      const documentId = req.nextUrl.searchParams.get("documentId")
      const version = req.nextUrl.searchParams.get("version")
      const v1 = req.nextUrl.searchParams.get("v1")
      const v2 = req.nextUrl.searchParams.get("v2")

      if (!documentId) {
        return NextResponse.json({ error: "documentId required" }, { status: 400 })
      }

      if (v1 && v2) {
        const diff = await diffVersions(organizationId, documentId, parseInt(v1), parseInt(v2))
        return NextResponse.json({ diff })
      }

      if (version) {
        const doc = await getDocumentVersion(organizationId, documentId, parseInt(version))
        if (!doc) return NextResponse.json({ error: "Version not found" }, { status: 404 })
        return NextResponse.json({ version: doc })
      }

      const versions = await getDocumentVersions(organizationId, documentId)
      return NextResponse.json({ versions })
    }

    const body = await req.json() as {
      action: "create" | "restore" | "cleanup"
      documentId: string
      content?: string
      changeSummary?: string
      version?: number
      keepLast?: number
    }

    switch (body.action) {
      case "create": {
        if (!body.documentId || !body.content) {
          return NextResponse.json({ error: "documentId and content required" }, { status: 400 })
        }
        const version = await createDocumentVersion(organizationId, body.documentId, body.content, userId, body.changeSummary)
        if (!version) return NextResponse.json({ error: "Failed to create version" }, { status: 500 })
        return NextResponse.json({ version })
      }
      case "restore": {
        if (!body.documentId || !body.version) {
          return NextResponse.json({ error: "documentId and version required" }, { status: 400 })
        }
        const restored = await restoreDocumentVersion(organizationId, body.documentId, body.version, userId)
        if (!restored) return NextResponse.json({ error: "Failed to restore version" }, { status: 500 })
        return NextResponse.json({ version: restored })
      }
      case "cleanup": {
        if (!body.documentId) {
          return NextResponse.json({ error: "documentId required" }, { status: 400 })
        }
        const deleted = await deleteOldVersions(organizationId, body.documentId, body.keepLast)
        return NextResponse.json({ deleted })
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (err) {
    console.error("[versions] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export { handler as POST, handler as GET }
