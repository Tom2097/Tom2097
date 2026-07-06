"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { getClientIp } from "@/lib/auth/audit"

// Schemas
const DocumentUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// GET /api/v1/resources/documents/[id] - Get single document
export const GET = withAuth(async (req: NextRequest, { organizationId, userId, params }) => {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  await appendComplianceAudit(
    organizationId,
    "document",
    id,
    "SEARCH",
    data,
    userId,
    getClientIp(req.headers),
    { endpoint: `/api/v1/resources/documents/${id}` }
  )

  return NextResponse.json(data)
}, { requireAny: ["documents:read", "documents:manage"] })

// PATCH /api/v1/resources/documents/[id] - Update document
export const PATCH = withAuth(async (req: NextRequest, { organizationId, userId, params }) => {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
  }

  const body = await req.json()
  const validation = DocumentUpdateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid document data", details: validation.error }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: existingDoc, error: fetchError } = await db
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single()

  if (fetchError || !existingDoc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const { data: updatedDoc, error: updateError } = await db
    .from("documents")
    .update({
      ...validation.data,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select()
    .single()

  if (updateError || !updatedDoc) {
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }

  await appendComplianceAudit(
    organizationId,
    "document",
    id,
    "UPDATE",
    updatedDoc,
    userId,
    getClientIp(req.headers),
    { endpoint: `/api/v1/resources/documents/${id}`, changes: validation.data }
  )

  return NextResponse.json(updatedDoc)
}, { requireAny: ["documents:update", "documents:manage"] })