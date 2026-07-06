"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { getClientIp } from "@/lib/auth/audit"

// Schemas
const DocumentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  file_path: z.string().min(1),
  file_type: z.string().min(1),
  file_size: z.number().int().positive(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const QuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  tag: z.string().optional(),
})

// GET /api/v1/resources/documents - List documents
export const GET = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const validation = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid query parameters", details: validation.error }, { status: 400 })
  }

  const { limit, offset, search, tag } = validation.data
  const db = createServiceClient()

  let query = db
    .from("documents")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  if (tag) {
    query = query.contains("tags", [tag])
  }

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }

  await appendComplianceAudit(
    organizationId,
    "document",
    "list",
    "SEARCH",
    { query: validation.data },
    userId,
    getClientIp(req.headers),
    { endpoint: "/api/v1/resources/documents" }
  )

  return NextResponse.json({ data, count })
}, { requireAny: ["documents:read", "documents:manage"] })

// POST /api/v1/resources/documents - Create document
const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const body = await req.json()
  const validation = DocumentSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid document data", details: validation.error }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("documents")
    .insert({
      organization_id: organizationId,
      name: validation.data.name,
      description: validation.data.description,
      file_path: validation.data.file_path,
      file_type: validation.data.file_type,
      file_size: validation.data.file_size,
      tags: validation.data.tags || [],
      metadata: validation.data.metadata || {},
      created_by: userId,
    })
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 })
  }

  await appendComplianceAudit(
    organizationId,
    "document",
    data.id,
    "CREATE",
    data,
    userId,
    getClientIp(req.headers),
    { endpoint: "/api/v1/resources/documents" }
  )

  return NextResponse.json(data)
}, { requireAny: ["documents:create", "documents:manage"] })

// DELETE /api/v1/resources/documents - Bulk delete documents
export const DELETE = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const { documentIds } = await req.json()
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: "No document IDs provided" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: documents, error: fetchError } = await db
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", documentIds)

  if (fetchError || !documents) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }

  const { error: deleteError } = await db
    .from("documents")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", documentIds)

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete documents" }, { status: 500 })
  }

  for (const doc of documents) {
    await appendComplianceAudit(
      organizationId,
      "document",
      doc.id,
      "DELETE",
      doc,
      userId,
      getClientIp(req.headers),
      { endpoint: "/api/v1/resources/documents" }
    )
  }

  return NextResponse.json({ success: true })
}, { requireAny: ["documents:delete", "documents:manage"] })