import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createServiceClient } from "@/lib/supabase/service"
import { generateEmbedding } from "@/lib/rag/rag"

interface SearchResult {
  documentId: string
  name: string
  snippet: string
  score: number
}

interface AskResponse {
  answer: string
  sources: SearchResult[]
}

export async function askAcrossDocuments(
  organizationId: string,
  question: string,
  limit = 10,
): Promise<AskResponse> {
  const db = createServiceClient()

  const queryEmb = await generateEmbedding(question)

  const { data: documents } = await db
    .from("documents")
    .select("id, name, content, summary")
    .eq("organization_id", organizationId)
    .not("content", "is", null)
    .limit(50)

  const docs = (documents ?? []) as Array<{
    id: string; name: string; content: string; summary: string | null
  }>

  const scored: Array<{ doc: typeof docs[0]; score: number; snippet: string }> = []
  for (const doc of docs) {
    const content = doc.content || doc.summary || ""
    if (!content) continue
    const emb = await generateEmbedding(content.slice(0, 2000))
    const score = cosineSimilarity(queryEmb, emb)
    if (score > 0.3) {
      const snippet = content.slice(0, 500)
      scored.push({ doc, score, snippet })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit)

  const context = top.map((s) =>
    `Document: ${s.doc.name}\nRelevance: ${Math.round(s.score * 100)}%\nContent: ${s.snippet}`
  ).join("\n\n---\n\n")

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: `${BASE_SYSTEM_PROMPT}
You are a document analysis assistant. Answer the user's question based ONLY on the provided document excerpts.
If the excerpts don't contain enough information, say so clearly. Cite specific documents.`,
    prompt: `Question: ${question}\n\nRelevant document excerpts:\n${context || "No relevant documents found."}`,
    temperature: 0.2,
    maxOutputTokens: 2000,
  })

  return {
    answer: result.text.trim(),
    sources: top.map((s) => ({
      documentId: s.doc.id,
      name: s.doc.name,
      snippet: s.snippet,
      score: Math.round(s.score * 100),
    })),
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}
