import { getSearchIndex, buildScopedFilter } from "./client"

/**
 * Search query helper (Module #4).
 * Hybrid full-text + semantic search, always tenant-scoped. Supports
 * faceted filtering by resource type and lightweight autocomplete.
 */

export interface SearchHit {
  id: string
  score: number
  resourceType: string
  resourceId: string
  title: string
  body: string
  url?: string
  metadata: Record<string, unknown>
}

export interface SearchQueryOptions {
  organizationId: string
  query: string
  /** Narrow to a single resource type (facet). */
  resourceType?: string
  limit?: number
  /**
   * Blend between full-text (0) and semantic (1). Defaults to 0.5 (hybrid).
   */
  semanticWeight?: number
  /** Enable reranking for higher-quality ordering. */
  reranking?: boolean
}

interface RawHit {
  id: string
  score: number
  content: {
    title?: string
    body?: string
    resourceType?: string
    organizationId?: string
  }
  metadata?: {
    resourceId?: string
    url?: string
    [key: string]: unknown
  }
}

function mapHit(hit: RawHit): SearchHit {
  return {
    id: hit.id,
    score: hit.score,
    resourceType: hit.content?.resourceType ?? "",
    resourceId: hit.metadata?.resourceId ?? "",
    title: hit.content?.title ?? "",
    body: hit.content?.body ?? "",
    url: hit.metadata?.url,
    metadata: hit.metadata ?? {},
  }
}

/** Run a tenant-scoped hybrid search. */
export async function search(options: SearchQueryOptions): Promise<SearchHit[]> {
  const { organizationId, query, resourceType, limit = 20, semanticWeight = 0.5, reranking = true } = options

  if (!query.trim()) return []

  const index = getSearchIndex()
  const results = await index.search({
    query,
    limit,
    filter: buildScopedFilter(organizationId, resourceType),
    semanticWeight,
    reranking,
  })

  return (results as unknown as RawHit[]).map(mapHit)
}

export interface FacetCount {
  resourceType: string
  count: number
}

/**
 * Faceted search: returns hits plus per-resource-type counts so callers can
 * render facet filters. Counts are computed from a broader result window.
 */
export async function searchWithFacets(
  options: SearchQueryOptions,
): Promise<{ hits: SearchHit[]; facets: FacetCount[] }> {
  // Pull a wider window (unfiltered by type) to compute facet counts.
  const facetWindow = await search({
    ...options,
    resourceType: undefined,
    limit: Math.max(options.limit ?? 20, 100),
  })

  const counts = new Map<string, number>()
  for (const hit of facetWindow) {
    counts.set(hit.resourceType, (counts.get(hit.resourceType) ?? 0) + 1)
  }
  const facets: FacetCount[] = [...counts.entries()]
    .map(([resourceType, count]) => ({ resourceType, count }))
    .sort((a, b) => b.count - a.count)

  // Hits respect the requested resourceType facet (if any).
  const hits = options.resourceType
    ? facetWindow.filter((h) => h.resourceType === options.resourceType).slice(0, options.limit ?? 20)
    : facetWindow.slice(0, options.limit ?? 20)

  return { hits, facets }
}

export interface Suggestion {
  text: string
  resourceType: string
  resourceId: string
}

/**
 * Autocomplete: lightweight, prefix-biased suggestions. Uses full-text-leaning
 * search (low semantic weight) for fast, literal matches and returns titles.
 */
export async function autocomplete(
  organizationId: string,
  prefix: string,
  limit = 8,
): Promise<Suggestion[]> {
  if (!prefix.trim()) return []

  const hits = await search({
    organizationId,
    query: prefix,
    limit,
    semanticWeight: 0.1,
    reranking: false,
  })

  return hits.map((h) => ({
    text: h.title,
    resourceType: h.resourceType,
    resourceId: h.resourceId,
  }))
}
