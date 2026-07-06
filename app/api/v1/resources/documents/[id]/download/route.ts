"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { createServiceClient } from "@/lib/supabase/service"
import { getClientIp } from "@/lib/auth/audit"

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

  // Generate signed URL from Supabase Storage
  const { data, error: downloadError } = await db.storage
    .from("documents")
    .createSignedUrl(document.file_path, 3600) // 1 hour expiry

  if (downloadError || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 })
  }

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

  return NextResponse.json({ url: data.signedUrl })
}, { requireAny: ["documents:read", "documents:manage"] })