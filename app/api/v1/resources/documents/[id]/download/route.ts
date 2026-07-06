"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { createServiceClient } from "@/lib/supabase/service"
import { getClientIp } from "@/lib/auth/audit"
import { Storage } from "@google-cloud/storage"

// GET /api/v1/resources/documents/[id]/download - Download document
export const GET = withAuth(async (req: NextRequest, { organizationId, userId, params }) => {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: document, error: fetchError } = await db
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single()

  if (fetchError || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  // In a real implementation, this would fetch the file from storage
  // For now, we'll return a mock response
  const storage = new Storage()
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)
  const file = bucket.file(document.file_path)

  const [exists] = await file.exists()
  if (!exists) {
    return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
  }

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  })

  await appendComplianceAudit(
    organizationId,
    "document",
    id,
    "DOWNLOAD",
    document,
    userId,
    getClientIp(req.headers),
    { endpoint: `/api/v1/resources/documents/${id}/download` }
  )

  return NextResponse.json({ url })
}, { requireAny: ["documents:read", "documents:manage"] })