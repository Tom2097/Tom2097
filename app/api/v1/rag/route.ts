import { NextRequest, NextResponse } from "next/server"
import { chunkDocument, generateEmbedding, hybridSearch, rerank } from "@/lib/rag/rag"

const documents = new Map<string, string>()

export async function POST(req: NextRequest) {
  try {
    const { action, content, query, metadata } = await req.json()
    if (action === "index") {
      const docId = `doc-${Date.now()}`
      documents.set(docId, content)
      const chunks = await chunkDocument(content, { ...metadata, docId })
      const indexed = chunks.map((c) => ({ ...c, embedding: generateEmbedding(c.content) }))
      return NextResponse.json({ docId, chunks: indexed.length })
    }
    if (action === "search") {
      const queryEmb = generateEmbedding(query)
      const chunkPromises = Array.from(documents.entries()).map(async ([docId, docContent]) => {
        const chunks = await chunkDocument(docContent, { docId })
        return chunks.map((c) => ({ ...c, embedding: generateEmbedding(c.content) }))
      })
      const nested = await Promise.all(chunkPromises)
      const allChunks = nested.flat()
      let results = hybridSearch(query, allChunks, queryEmb, 0.7, 20)
      results = rerank(results, query)
      return NextResponse.json({ results: results.slice(0, 5) })
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
