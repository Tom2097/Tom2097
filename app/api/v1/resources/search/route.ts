"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { getClientIp } from "@/lib/auth/audit"

// Schema
const SearchSchema = z.object({
  query: z.string().min(1),
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  type: z.enum(["all", "documents", "articles"]).default("all"),
})

// GET /api/v1/resources/search - Unified search
export const GET = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const validation = SearchSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid search parameters", details: validation.error }, { status: 400 })
  }

  const { query, limit, offset, type } = validation.data
  const db = createServiceClient()
  let results = []
  let count = 0

  if (type === "all" || type === "documents") {
    const { data: docs, error: docsError, count: docsCount } = await db
      .from("documents")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (!docsError) {
      results.push(...docs.map(doc => ({ ...doc, type: "document" })))
      count += docsCount || 0
    }
  }

  if (type === "all" || type === "articles") {
    const { data: articles, error: articlesError, count: articlesCount } = await db
      .from("kb_articles")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (!articlesError) {
      results.push(...articles.map(article => ({ ...article, type: "article" })))
      count += articlesCount || 0
    }
  }

  // Sort combined results by created_at
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  await appendComplianceAudit(
    organizationId,
    "search",
    "unified",
    "SEARCH",
    { query, type, limit, offset },
    userId,
    getClientIp(req.headers),
    { endpoint: "/api/v1/resources/search" }
  )

  return NextResponse.json({ data: results, count })
}, { requireAny: ["documents:read", "kb:read", "search:execute"] })