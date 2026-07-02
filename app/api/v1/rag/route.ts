import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { chunkDocument, generateEmbedding, hybridSearch, rerank } from "@/lib/rag/rag"

const indexSchema = z.object({
  action: z.literal("index"),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
})

const searchSchema = z.object({
  action: z.literal("search"),
  query: z.string().min(1),
})

const requestSchema = z.discriminatedUnion("action", [indexSchema, searchSchema])

const documents = new Map<string, string>()

export async function POST(req: NextRequest) {
  try {
    const parsed = await req.json().then((body) => requestSchema.parse(body))
    const { action } = parsed

    if (action === "index") {
      const docId = `doc-${Date.now()}`
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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
