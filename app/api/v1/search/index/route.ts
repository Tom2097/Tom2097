import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { indexDocuments, removeDocument } from "@/lib/search/index-helper"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/**
 * Indexing API (Module #4).
 * POST   /api/v1/search/index  -> upsert one or more documents
 * DELETE /api/v1/search/index  -> remove a single document
 *
 * Tenant scoping: organizationId is taken from the auth context, never the
 * request body, so callers can only index/delete within their own tenant.
 */

interface IndexRequestItem {
  resourceType: string
  resourceId: string
  title: string
  body?: string
  url?: string
  metadata?: Record<string, unknown>
}

export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext) => {
    const body = (await req.json()) as { documents?: IndexRequestItem[] }
    const documents = body.documents ?? []

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "documents[] is required" },
        { status: 400 },
      )
    }

    for (const doc of documents) {
      if (!doc.resourceType || !doc.resourceId || !doc.title) {
        return NextResponse.json(
          { error: "Bad Request", message: "each document requires resourceType, resourceId, title" },
          { status: 400 },
        )
      }
    }

    const count = await indexDocuments(
      documents.map((d) => ({ ...d, organizationId: ctx.organizationId })),
    )

    await logAuthEvent({
      action: "search.documents_indexed",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      resourceType: "search",
      metadata: { count },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ indexed: count })
  },
  { requireAll: ["analytics:read"] },
)

export const DELETE = withAuth(
  async (req: NextRequest, ctx: AuthContext) => {
    const { searchParams } = req.nextUrl
    const resourceType = searchParams.get("resourceType")
    const resourceId = searchParams.get("resourceId")

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: "Bad Request", message: "resourceType and resourceId are required" },
        { status: 400 },
      )
    }

    await removeDocument(ctx.organizationId, resourceType, resourceId)

    await logAuthEvent({
      action: "search.document_removed",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      resourceType: "search",
      resourceId,
      metadata: { resourceType },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ removed: true })
  },
  { requireAll: ["analytics:read"] },
)
