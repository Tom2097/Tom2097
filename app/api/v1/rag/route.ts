import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { chunkDocument, generateEmbedding, hybridSearch, rerank } from "@/lib/rag/rag"

const MAX_CONTENT_CHARS = 200_000
const MAX_DOCUMENTS_PER_ORG = 50

const indexSchema = z.object({
  action: z.literal("index"),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
  metadata: z.record(z.unknown()).optional(),
})

const searchSchema = z.object({
  action: z.literal("search"),
  query: z.string().min(1),
})

const requestSchema = z.discriminatedUnion("action", [indexSchema, searchSchema])

// Keyed by organization so one tenant's search can never see another's documents.
const documentsByOrg = new Map<string, Map<string, string>>()

export const POST = withAuth(
  async (req, context) => {
    // Indexing and searching can both call the paid embedding model.
    const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
    if (rateLimited) return rateLimited

    try {
      const parsed = await req.json().then((body) => requestSchema.parse(body))
      const documents = documentsByOrg.get(context.organizationId) ?? new Map<string, string>()
      documentsByOrg.set(context.organizationId, documents)

      if (parsed.action === "index") {
        if (documents.size >= MAX_DOCUMENTS_PER_ORG) {
          const oldest = documents.keys().next().value
          if (oldest) documents.delete(oldest)
        }
        const docId = `doc-${crypto.randomUUID()}`
        documents.set(docId, parsed.content)
        const chunks = await chunkDocument(parsed.content, { ...parsed.metadata, docId })
        const indexed = await Promise.all(chunks.map(async (c) => ({ ...c, embedding: await generateEmbedding(c.content) })))
        return NextResponse.json({ docId, chunks: indexed.length })
      }

      const queryEmb = await generateEmbedding(parsed.query)
      const chunkPromises = Array.from(documents.entries()).map(async ([docId, docContent]) => {
        const chunks = await chunkDocument(docContent, { docId })
        return Promise.all(chunks.map(async (c) => ({ ...c, embedding: await generateEmbedding(c.content) })))
      })
      const nested = await Promise.all(chunkPromises)
      const allChunks = nested.flat()
      let results = hybridSearch(parsed.query, allChunks, queryEmb, 0.7, 20)
      results = rerank(results, parsed.query)
      return NextResponse.json({ results: results.slice(0, 5) })
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
      }
      console.error("[rag] request failed:", err)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
  { requireAny: ["documents:create", "documents:manage"] },
)
