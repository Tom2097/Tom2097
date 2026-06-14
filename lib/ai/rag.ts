import { search } from "@/lib/search/query"

/**
 * Module #5: Retrieval-Augmented Generation.
 *
 * Reuses the Module #4 tenant-scoped search index to pull relevant context
 * for a user query. Retrieval is ALWAYS scoped to the caller's organization id
 * (passed from the verified auth context, never from the request body).
 */

export interface RagContext {
  /** Formatted context block to inject into the system prompt. */
  contextBlock: string
  /** Raw sources for optional citation in the response. */
  sources: Array<{ title: string; resourceType: string; resourceId: string; url?: string }>
}

/**
 * Retrieve tenant context relevant to `query` and format it for prompt injection.
 * Returns an empty context block when nothing relevant is found.
 */
export async function retrieveContext(
  organizationId: string,
  query: string,
  limit = 6,
): Promise<RagContext> {
  if (!query.trim()) {
    return { contextBlock: "", sources: [] }
  }

  const hits = await search({
    organizationId,
    query,
    limit,
    semanticWeight: 0.7, // favor semantic relevance for RAG
    reranking: true,
  })

  if (hits.length === 0) {
    return { contextBlock: "", sources: [] }
  }

  const lines = hits.map((h, i) => {
    const body = h.body?.slice(0, 500) ?? ""
    return `[${i + 1}] (${h.resourceType}) ${h.title}\n${body}`
  })

  const contextBlock = [
    "Relevant context from this organization's data:",
    "---",
    lines.join("\n\n"),
    "---",
    "Use the context above when it is relevant to the user's question. Cite sources by their bracketed number.",
  ].join("\n")

  const sources = hits.map((h) => ({
    title: h.title,
    resourceType: h.resourceType,
    resourceId: h.resourceId,
    url: h.url,
  }))

  return { contextBlock, sources }
}
