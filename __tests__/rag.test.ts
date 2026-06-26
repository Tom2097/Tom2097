import { describe, it, expect } from "vitest"
import {
  chunkDocument,
  generateEmbedding,
  cosineSimilarity,
  hybridSearch,
  rerank,
  embedChunks,
} from "@/lib/rag/rag"

describe("chunkDocument", () => {
  it("splits content into chunks of specified size", async () => {
    const content = "a".repeat(1000)
    const chunks = await chunkDocument(content, { source: "test" }, 200, 0)
    expect(chunks.length).toBe(5)
    expect(chunks[0].content.length).toBe(200)
  })

  it("includes metadata in each chunk", async () => {
    const chunks = await chunkDocument("hello world", { source: "test", id: 42 })
    for (const chunk of chunks) {
      expect(chunk.metadata.source).toBe("test")
      expect(chunk.metadata.id).toBe(42)
    }
  })

  it("applies overlap between chunks", async () => {
    const content = "abcdefghij"
    const chunks = await chunkDocument(content, {}, 6, 2)
    expect(chunks.length).toBe(3)
    expect(chunks[0].content).toBe("abcdef")
    expect(chunks[1].content).toBe("efghij")
  })

  it("returns single chunk for short content", async () => {
    const chunks = await chunkDocument("short", {})
    expect(chunks.length).toBe(1)
    expect(chunks[0].content).toBe("short")
  })
})

describe("generateEmbedding", () => {
  it("returns a deterministic embedding (384 dimensions) when no API key", async () => {
    const emb = await generateEmbedding("test text")
    expect(emb.length).toBe(384)
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0))
    expect(norm).toBeCloseTo(1, 5)
  })

  it("returns same embedding for same text", async () => {
    const a = await generateEmbedding("hello")
    const b = await generateEmbedding("hello")
    expect(a).toEqual(b)
  })

  it("returns different embedding for different text", async () => {
    const a = await generateEmbedding("hello")
    const b = await generateEmbedding("world")
    expect(a).not.toEqual(b)
  })
})

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1], [1, 0])).toBe(0)
  })

  it("returns positive value for similar vectors", () => {
    const sim = cosineSimilarity([1, 2, 3], [1, 2, 3.5])
    expect(sim).toBeGreaterThan(0.9)
  })
})

describe("hybridSearch", () => {
  const chunks = [
    { id: "1", content: "machine learning is fun", metadata: {}, embedding: [1, 0, 0] },
    { id: "2", content: "deep learning with neural networks", metadata: {}, embedding: [0, 1, 0] },
    { id: "3", content: "python programming for data science", metadata: {}, embedding: [0, 0, 1] },
  ]

  it("ranks by combined semantic + keyword score", () => {
    const results = hybridSearch("machine learning", chunks, [1, 0, 0])
    expect(results.length).toBe(3)
    expect(results[0].id).toBe("1")
  })

  it("respects topK parameter", () => {
    const results = hybridSearch("test", chunks, [1, 0, 0], 0.5, 2)
    expect(results.length).toBe(2)
  })

  it("handles chunks without embeddings (keyword-only)", () => {
    const noEmbChunks = chunks.map((c) => ({ ...c, embedding: undefined }))
    const results = hybridSearch("python", noEmbChunks, [1, 0, 0])
    expect(results[0].id).toBe("3")
  })
})

describe("rerank", () => {
  const results = [
    { id: "3", content: "python for data science", metadata: {}, score: 0.5, embedding: [0, 0, 1] },
    { id: "1", content: "machine learning basics", metadata: {}, score: 0.7, embedding: [1, 0, 0] },
    { id: "2", content: "data science with python", metadata: {}, score: 0.6, embedding: [0, 1, 0] },
  ]

  it("boosts exact phrase matches", () => {
    const reranked = rerank(results, "data science")
    expect(reranked.length).toBe(3)
    const top = reranked[0]
    expect(["2", "3"]).toContain(top.id)
  })
})

describe("embedChunks", () => {
  it("returns chunks unchanged when no API key", async () => {
    const chunks = [
      { id: "1", content: "hello", metadata: {} },
      { id: "2", content: "world", metadata: {} },
    ]
    const result = await embedChunks(chunks)
    expect(result.length).toBe(2)
    expect(result[0].embedding).toBeUndefined()
  })
})