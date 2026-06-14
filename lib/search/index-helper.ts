import {
  getSearchIndex,
  buildDocumentId,
  type SearchContent,
  type SearchMetadata,
} from "./client"

/**
 * Indexing helper (Module #4).
 * Reusable functions other modules call when they create/update/delete
 * records, so searchable content stays in sync. All operations are
 * tenant-scoped via organizationId.
 */

export interface IndexableDocument {
  organizationId: string
  resourceType: string
  resourceId: string
  title: string
  body?: string
  url?: string
  /** Extra non-indexed metadata to return with hits. */
  metadata?: Record<string, unknown>
}

/**
 * Upsert one or more documents into the universal index.
 * Returns the number of documents written.
 */
export async function indexDocuments(docs: IndexableDocument[]): Promise<number> {
  if (docs.length === 0) return 0

  const index = getSearchIndex()

  const payload = docs.map((doc) => {
    const content: SearchContent = {
      title: doc.title,
      body: doc.body ?? "",
      resourceType: doc.resourceType,
      organizationId: doc.organizationId,
    }
    const metadata: SearchMetadata = {
      resourceId: doc.resourceId,
      url: doc.url,
      ...doc.metadata,
    }
    return {
      id: buildDocumentId(doc.organizationId, doc.resourceType, doc.resourceId),
      content,
      metadata,
    }
  })

  await index.upsert(payload)
  return payload.length
}

/** Convenience wrapper for a single document. */
export async function indexDocument(doc: IndexableDocument): Promise<void> {
  await indexDocuments([doc])
}

/**
 * Remove a document from the index. Scoped by tenant + type + resource id,
 * so a tenant can never delete another tenant's document.
 */
export async function removeDocument(
  organizationId: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  const index = getSearchIndex()
  await index.delete({ ids: [buildDocumentId(organizationId, resourceType, resourceId)] })
}

/** Bulk delete by composite ids. */
export async function removeDocuments(
  organizationId: string,
  items: Array<{ resourceType: string; resourceId: string }>,
): Promise<void> {
  if (items.length === 0) return
  const index = getSearchIndex()
  const ids = items.map((i) => buildDocumentId(organizationId, i.resourceType, i.resourceId))
  await index.delete({ ids })
}
