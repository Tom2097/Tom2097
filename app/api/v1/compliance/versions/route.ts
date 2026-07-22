"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  createDocumentVersion,
  getDocumentVersion,
  getDocumentVersions,
} from "@/lib/compliance/document-versioning"

// GET /api/v1/compliance/versions?documentId=xxx[&version=n]
export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = req.nextUrl
  const documentId = searchParams.get("documentId")

  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 })
  }

  const versionParam = searchParams.get("version")
  if (versionParam !== null) {
    const version = Number(versionParam)
    if (!Number.isInteger(version)) {
      return NextResponse.json({ error: "version must be an integer" }, { status: 400 })
    }
    const doc = await getDocumentVersion(organizationId, documentId, version)
    if (!doc) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }
    return NextResponse.json(doc)
  }

  const versions = await getDocumentVersions(organizationId, documentId)
  return NextResponse.json(versions)
}, { requireAny: ["documents:read", "documents:manage", "compliance:read"] })

// POST /api/v1/compliance/versions
export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const { documentId, content, changeSummary } = await req.json()

  if (typeof documentId !== "string" || !documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 })
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 })
  }

  const version = await createDocumentVersion(
    organizationId,
    documentId,
    content,
    userId,
    typeof changeSummary === "string" ? changeSummary : null,
  )

  if (!version) {
    return NextResponse.json({ error: "Document version creation failed" }, { status: 400 })
  }

  return NextResponse.json(version)
}, { requireAny: ["documents:update", "documents:manage", "compliance:write"] })
