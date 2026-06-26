import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export interface Chunk { id: string; content: string; metadata: Record<string, unknown>; embedding?: number[] }
export interface SearchResult extends Chunk { score: number }

let embedModel: ReturnType<ReturnType<typeof createOpenAICompatible>["textEmbeddingModel"]> | null = null

function getEmbedModel() {
  if (embedModel === undefined) {
    embedModel = process.env.MISTRAL_API_KEY
      ? createOpenAICompatible({
          name: "mistral",
          baseURL: "https://api.mistral.ai/v1",
          apiKey: process.env.MISTRAL_API_KEY,
        }).textEmbeddingModel("mistral-embed")
      : null
  }
  return embedModel
}

function deterministicEmbedding(text: string): number[] {
  const dim = 384
  const embedding: number[] = new Array(dim)
  const hash = text.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  for (let j = 0; j < dim; j++) {
    embedding[j] = Math.sin(hash * (j + 1)) * Math.cos(text.length * (j + 1))
  }
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0))
  return embedding.map((v) => v / norm)
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getEmbedModel()
  if (!model) return deterministicEmbedding(text)
  try {
    const { embeddings } = await model.doEmbed({ values: [text] })
    return embeddings[0]
  } catch {
    return deterministicEmbedding(text)
  }
}

export async function embedChunks(chunks: Chunk[]): Promise<Chunk[]> {
  const model = getEmbedModel()
  if (!model) return chunks
  try {
    const { embeddings } = await model.doEmbed({ values: chunks.map((c) => c.content) })
    return chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] ?? deterministicEmbedding(chunk.content) }))
  } catch {
    return chunks
  }
}

export async function chunkDocument(
  content: string,
  metadata: Record<string, unknown>,
  chunkSize = 512,
  overlap = 64
): Promise<Chunk[]> {
  const chunks: Chunk[] = []
  let i = 0
  while (i < content.length) {
    const end = Math.min(i + chunkSize, content.length)
    const chunk = content.slice(i, end)
    chunks.push({
      id: `chunk-${chunks.length}-${Date.now()}`,
      content: chunk,
      metadata: { ...metadata, chunkIndex: chunks.length, charStart: i, charEnd: end },
    })
    i += chunkSize - overlap
  }
  return chunks
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0; let na = 0; let nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export function hybridSearch(
  query: string,
  chunks: Chunk[],
  queryEmbedding: number[],
  alpha = 0.7,
  topK = 10
): SearchResult[] {
  const results: SearchResult[] = chunks.map((chunk) => {
    const semanticScore = chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0
    const keywordCount = query.toLowerCase().split(" ").filter((w) => chunk.content.toLowerCase().includes(w)).length
    const keywordScore = query.split(" ").length > 0 ? keywordCount / query.split(" ").length : 0
    const score = alpha * semanticScore + (1 - alpha) * keywordScore
    return { ...chunk, score }
  })

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, topK)
}

export function rerank(results: SearchResult[], query: string): SearchResult[] {
  return results
    .map((r) => {
      const queryWords = query.toLowerCase().split(" ")
      const contentLower = r.content.toLowerCase()
      const exactPhraseBonus = contentLower.includes(query.toLowerCase()) ? 0.2 : 0
      const termDensity = queryWords.length > 0 ? queryWords.filter((w) => contentLower.includes(w)).length / queryWords.length : 0
      return { ...r, score: r.score * 0.6 + termDensity * 0.2 + exactPhraseBonus }
    })
    .sort((a, b) => b.score - a.score)
}