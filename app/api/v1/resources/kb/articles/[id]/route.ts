"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { getClientIp } from "@/lib/auth/audit"

// Schemas
const ArticleUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// GET /api/v1/resources/kb/articles/[id] - Get single article
export const GET = withAuth(async (req: NextRequest, { organizationId, userId, params }) => {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Article ID is required" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("kb_articles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  await appendComplianceAudit(
    organizationId,
    "kb_article",
    id,
    "SEARCH",
    data,
    userId,
    getClientIp(req.headers),
    { endpoint: `/api/v1/resources/kb/articles/${id}` }
  )

  return NextResponse.json(data)
}, { requireAny: ["kb:read", "kb:manage"] })

// PATCH /api/v1/resources/kb/articles/[id] - Update article
export const PATCH = withAuth(async (req: NextRequest, { organizationId, userId, params }) => {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Article ID is required" }, { status: 400 })
  }

  const body = await req.json()
  const validation = ArticleUpdateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid article data", details: validation.error }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: existingArticle, error: fetchError } = await db
    .from("kb_articles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single()

  if (fetchError || !existingArticle) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  const { data: updatedArticle, error: updateError } = await db
    .from("kb_articles")
    .update({
      ...validation.data,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select()
    .single()

  if (updateError || !updatedArticle) {
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 })
  }

  await appendComplianceAudit(
    organizationId,
    "kb_article",
    id,
    "UPDATE",
    updatedArticle,
    userId,
    getClientIp(req.headers),
    { endpoint: `/api/v1/resources/kb/articles/${id}`, changes: validation.data }
  )

  return NextResponse.json(updatedArticle)
}, { requireAny: ["kb:update", "kb:manage"] })

// DELETE /api/v1/resources/kb/articles/[id] - Delete single article
export const DELETE = withAuth(async (req: NextRequest, { organizationId, userId, params }) => {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Article ID is required" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: article, error: fetchError } = await db
    .from("kb_articles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single()

  if (fetchError || !article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  const { error: deleteError } = await db
    .from("kb_articles")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 })
  }

  await appendComplianceAudit(
    organizationId,
    "kb_article",
    id,
    "DELETE",
    article,
    userId,
    getClientIp(req.headers),
    { endpoint: `/api/v1/resources/kb/articles/${id}` }
  )

  return NextResponse.json({ success: true })
}, { requireAny: ["kb:delete", "kb:manage"] })