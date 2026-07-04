import { Search } from "@upstash/search"

/**
 * Universal Search System (Module #4).
 * Connectionless (HTTP) Upstash Search client.
 *
 * Tenant isolation: every document stores `organizationId` in its content,
 * and every query is filtered by the caller's organizationId. This mirrors
 * the multi-tenant scoping pattern used across Modules #1-#3.
 */

/** Shape of searchable content stored in the index. */
export interface SearchContent {
  /** Primary display text (indexed for full-text + semantic). */
  title: string
  /** Longer body text (indexed). */
  body: string
  /** Resource type, e.g. "organization" | "profile" | "role" | "team". */
  resourceType: string
  /** Tenant scope. Used as a hard filter on every query. */
  organizationId: string
  [key: string]: string
}

/** Non-indexed metadata returned with each hit. */
export interface SearchMetadata {
  /** ID of the underlying record in its source table. */
  resourceId: string
  /** Optional deep link to the resource. */
  url?: string
  [key: string]: unknown
}

const INDEX_NAME = "digit-universal"

let cachedClient: Search | null = null

function getClient(): Search | null {
  if (cachedClient) return cachedClient

  const url = process.env.UPSTASH_SEARCH_REST_URL
  const token = process.env.UPSTASH_SEARCH_REST_TOKEN

  if (!url || !token) {
    return null
  }

  cachedClient = new Search({ url, token })
  return cachedClient
}

/** Access the shared universal index with typed content + metadata. */
export function getSearchIndex(): ReturnType<Search["index"]> | null {
  const client = getClient()
  if (!client) return null
  return client.index(INDEX_NAME)
}

/**
 * Build a tenant-scoped filter string, optionally narrowed by resource type.
 * Always includes organizationId so cross-tenant hits are impossible.
 */
export function buildScopedFilter(organizationId: string, resourceType?: string): string {
  const clauses = [`organizationId = '${escapeFilterValue(organizationId)}'`]
  if (resourceType) {
    clauses.push(`resourceType = '${escapeFilterValue(resourceType)}'`)
  }
  return clauses.join(" AND ")
}

/** Escape single quotes to keep the filter expression well-formed. */
function escapeFilterValue(value: string): string {
  return value.replace(/'/g, "\\'")
}

/**
 * Compose a globally-unique, tenant-namespaced document id so two tenants
 * can never collide on the same source resource id.
 */
export function buildDocumentId(organizationId: string, resourceType: string, resourceId: string): string {
  return `${organizationId}:${resourceType}:${resourceId}`
}
