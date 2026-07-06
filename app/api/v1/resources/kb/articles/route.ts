"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { getClientIp } from "@/lib/auth/audit"

// Schemas
const ArticleSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
})

const QuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  published: z.coerce.boolean().optional(),
})

// GET /api/v1/resources/kb/articles - List articles
export const GET = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const validation = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid query parameters", details: validation.error }, { status: 400 })
  }

  const { limit, offset, search, category, tag, published } = validation.data
  const db = createServiceClient()

  let query = db
    .from("kb_articles")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  }

  if (category) {
    query = query.eq("category", category)
  }

  if (tag) {
    query = query.contains("tags", [tag])
  }

  if (published !== undefined) {
    query = query.eq("is_published", published)
  }

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 })
  }

  await appendComplianceAudit(
    organizationId,
    "kb_article",
    "list",
    "SEARCH",
    { query: validation.data },
    userId,
    getClientIp(req.headers),
    { endpoint: "/api/v1/resources/kb/articles" }
  )

  return NextResponse.json({ data, count })
}, { requireAny: ["kb:read", "kb:manage"] })

// POST /api/v1/resources/kb/articles - Create article
const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const body = await req.json()
  const validation = ArticleSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid article data", details: validation.error }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("kb_articles")
    .insert({
      organization_id: organizationId,
      title: validation.data.title,
      content: validation.data.content,
      category: validation.data.category,
      tags: validation.data.tags || [],
      is_published: validation.data.is_published,
      metadata: validation.data.metadata || {},
      created_by: userId,
    })
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 })
  }

  await appendComplianceAudit(
    organizationId,
    "kb_article",
    data.id,
    "CREATE",
    data,
    userId,
    getClientIp(req.headers),
    { endpoint: "/api/v1/resources/kb/articles" }
  )

  return NextResponse.json(data)
}, { requireAny: ["kb:create", "kb:manage"] })

// DELETE /api/v1/resources/kb/articles - Bulk delete articles
export const DELETE = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const { articleIds } = await req.json()
  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return NextResponse.json({ error: "No article IDs provided" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: articles, error: fetchError } = await db
    .from("kb_articles")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", articleIds)

  if (fetchError || !articles) {
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 })
  }

  const { error: deleteError } = await db
    .from("kb_articles")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", articleIds)

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete articles" }, { status: 500 })
  }

  for (const article of articles) {
    await appendComplianceAudit(
      organizationId,
      "kb_article",
      article.id,
      "DELETE",
      article,
      userId,
      getClientIp(req.headers),
      { endpoint: "/api/v1/resources/kb/articles" }
    )
  }

  return NextResponse.json({ success: true })
}, { requireAny: ["kb:delete", "kb:manage"] })