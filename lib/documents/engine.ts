import { createServiceClient } from "@/lib/supabase/service"
import { indexDocument, removeDocument } from "@/lib/search/index-helper"
import {
  DOCUMENT_BUCKET,
  DOCUMENT_STATUSES,
  type CreateUploadInput,
  type DocumentRecord,
  type DocumentUpdate,
  type DocumentVersion,
  type ListDocumentsOptions,
  type UploadTicket,
} from "./types"

/**
 * Module #12: Document engine.
 *
 * Bytes are stored in the PRIVATE Supabase Storage bucket "documents" under the
 * path "<organization_id>/<document_id>/v<n>/<filename>", so the first path
 * segment is the tenant boundary (matched by storage RLS). Writes use the
 * service client but EVERY function takes an already-validated organizationId
 * (resolved by withAuth) and scopes all I/O to it.
 */

const SIGNED_DOWNLOAD_TTL = 60 * 10 // 10 minutes

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").trim() || "file"
}

function pickStatus(v: unknown, fallback: DocumentRecord["status"]): DocumentRecord["status"] {
  return DOCUMENT_STATUSES.includes(v as DocumentRecord["status"])
    ? (v as DocumentRecord["status"])
    : fallback
}

function buildPath(orgId: string, documentId: string, version: number, fileName: string): string {
  return `${orgId}/${documentId}/v${version}/${sanitizeName(fileName)}`
}

export function validateUpload(input: unknown): string | null {
  if (!input || typeof input !== "object") return "payload must be an object"
  const f = input as CreateUploadInput
  if (!f.name || typeof f.name !== "string" || !f.name.trim()) return "name is required"
  if (f.name.length > 400) return "name too long (max 400)"
  if (f.sizeBytes != null && (typeof f.sizeBytes !== "number" || f.sizeBytes < 0)) {
    return "sizeBytes must be a non-negative number"
  }
  if (f.tags != null && !Array.isArray(f.tags)) return "tags must be an array"
  return null
}

/**
 * Begin an upload. Creates a "pending" document row (+ v1 version row) and a
 * signed upload URL the client uses to PUT bytes directly to storage.
 */
export async function createUpload(
  organizationId: string,
  uploadedBy: string,
  input: CreateUploadInput,
): Promise<UploadTicket> {
  const db = createServiceClient()

  // Validate folder belongs to this org (if provided).
  if (input.folderId) {
    const { data: folder } = await db
      .from("document_folders")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.folderId)
      .maybeSingle()
    if (!folder) throw new Error("folder not found")
  }

  const { data: doc, error } = await db
    .from("documents")
    .insert({
      organization_id: organizationId,
      folder_id: input.folderId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      storage_path: "", // filled after we know the id
      mime_type: input.mimeType || "application/octet-stream",
      size_bytes: input.sizeBytes ?? 0,
      current_version: 1,
      status: "pending",
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single()
  if (error || !doc) {
    console.log("[v0] createUpload insert failed:", error?.message)
    throw new Error("failed to create document")
  }

  const storagePath = buildPath(organizationId, doc.id, 1, input.name)

  // Backfill storage_path + create the v1 version row.
  const { error: updErr } = await db
    .from("documents")
    .update({ storage_path: storagePath })
    .eq("organization_id", organizationId)
    .eq("id", doc.id)
  if (updErr) {
    console.log("[v0] createUpload path update failed:", updErr.message)
    throw new Error("failed to prepare document")
  }
  await db.from("document_versions").insert({
    organization_id: organizationId,
    document_id: doc.id,
    version: 1,
    storage_path: storagePath,
    mime_type: input.mimeType || "application/octet-stream",
    size_bytes: input.sizeBytes ?? 0,
    uploaded_by: uploadedBy,
  })

  const { data: signed, error: signErr } = await db.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(storagePath)
  if (signErr || !signed) {
    console.log("[v0] createSignedUploadUrl failed:", signErr?.message)
    throw new Error("failed to create upload url")
  }

  return {
    documentId: doc.id,
    storagePath,
    token: signed.token,
    signedUrl: signed.signedUrl,
  }
}

/**
 * Confirm an upload finished: flip status to "ready", persist final size, and
 * index the document for search.
 */
export async function confirmUpload(
  organizationId: string,
  documentId: string,
  sizeBytes?: number,
): Promise<DocumentRecord | null> {
  const db = createServiceClient()
  const update: Record<string, unknown> = { status: "ready" }
  if (typeof sizeBytes === "number" && sizeBytes >= 0) update.size_bytes = sizeBytes

  const { data, error } = await db
    .from("documents")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] confirmUpload failed:", error.message)
    throw new Error("failed to confirm upload")
  }
  const doc = (data as DocumentRecord) ?? null
  if (doc) await indexDocumentRecord(doc)
  return doc
}

export async function listDocuments(
  organizationId: string,
  opts: ListDocumentsOptions,
): Promise<{ documents: DocumentRecord[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("documents")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.folderId !== undefined) {
    query = opts.folderId === null ? query.is("folder_id", null) : query.eq("folder_id", opts.folderId)
  }
  if (opts.status) query = query.eq("status", opts.status)
  if (opts.tag) query = query.contains("tags", [opts.tag])
  if (opts.search && opts.search.trim()) {
    const term = opts.search.trim().replace(/[%,]/g, " ")
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }

  query = query.order("created_at", { ascending: false }).range(opts.offset, opts.offset + opts.limit - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listDocuments failed:", error.message)
    throw new Error("failed to list documents")
  }
  return { documents: (data ?? []) as DocumentRecord[], total: count ?? 0 }
}

export async function getDocument(
  organizationId: string,
  documentId: string,
): Promise<DocumentRecord | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .maybeSingle()
  if (error) {
    console.log("[v0] getDocument failed:", error.message)
    throw new Error("failed to fetch document")
  }
  return (data as DocumentRecord) ?? null
}

export async function listVersions(
  organizationId: string,
  documentId: string,
): Promise<DocumentVersion[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("document_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .order("version", { ascending: false })
  if (error) {
    console.log("[v0] listVersions failed:", error.message)
    throw new Error("failed to list versions")
  }
  return (data ?? []) as DocumentVersion[]
}

export async function updateDocument(
  organizationId: string,
  documentId: string,
  patch: DocumentUpdate,
): Promise<DocumentRecord | null> {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined && patch.name.trim()) update.name = patch.name.trim()
  if (patch.description !== undefined) update.description = patch.description?.trim() || null
  if (patch.folderId !== undefined) update.folder_id = patch.folderId
  if (patch.tags !== undefined) update.tags = patch.tags
  if (patch.status !== undefined) update.status = pickStatus(patch.status, "ready")
  if (patch.metadata !== undefined) update.metadata = patch.metadata

  if (Object.keys(update).length === 0) return getDocument(organizationId, documentId)

  const db = createServiceClient()
  const { data, error } = await db
    .from("documents")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] updateDocument failed:", error.message)
    throw new Error("failed to update document")
  }
  const doc = (data as DocumentRecord) ?? null
  if (doc) await indexDocumentRecord(doc)
  return doc
}

/**
 * Begin a new version upload for an existing document. Returns a signed upload
 * URL; the version row is created immediately and current_version bumped on
 * confirm.
 */
export async function createVersionUpload(
  organizationId: string,
  documentId: string,
  uploadedBy: string,
  fileName: string,
  mimeType?: string,
  sizeBytes?: number,
): Promise<UploadTicket> {
  const doc = await getDocument(organizationId, documentId)
  if (!doc) throw new Error("document not found")

  const nextVersion = doc.current_version + 1
  const storagePath = buildPath(organizationId, documentId, nextVersion, fileName || doc.name)

  const db = createServiceClient()
  const { error: verErr } = await db.from("document_versions").insert({
    organization_id: organizationId,
    document_id: documentId,
    version: nextVersion,
    storage_path: storagePath,
    mime_type: mimeType || doc.mime_type,
    size_bytes: sizeBytes ?? 0,
    uploaded_by: uploadedBy,
  })
  if (verErr) {
    console.log("[v0] createVersionUpload insert failed:", verErr.message)
    throw new Error("failed to create version")
  }

  const { data: signed, error: signErr } = await db.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(storagePath)
  if (signErr || !signed) {
    console.log("[v0] createSignedUploadUrl (version) failed:", signErr?.message)
    throw new Error("failed to create upload url")
  }

  return { documentId, storagePath, token: signed.token, signedUrl: signed.signedUrl }
}

/** Promote a freshly-uploaded version to current. */
export async function confirmVersion(
  organizationId: string,
  documentId: string,
  version: number,
  sizeBytes?: number,
): Promise<DocumentRecord | null> {
  const db = createServiceClient()
  const { data: ver } = await db
    .from("document_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .eq("version", version)
    .maybeSingle()
  if (!ver) throw new Error("version not found")

  const { data, error } = await db
    .from("documents")
    .update({
      current_version: version,
      storage_path: ver.storage_path,
      mime_type: ver.mime_type,
      size_bytes: typeof sizeBytes === "number" ? sizeBytes : ver.size_bytes,
      status: "ready",
    })
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] confirmVersion failed:", error.message)
    throw new Error("failed to confirm version")
  }
  return (data as DocumentRecord) ?? null
}

/** Create a short-lived signed download URL for the current (or given) path. */
export async function getDownloadUrl(
  organizationId: string,
  documentId: string,
  version?: number,
): Promise<{ url: string; document: DocumentRecord } | null> {
  const doc = await getDocument(organizationId, documentId)
  if (!doc) return null

  let path = doc.storage_path
  if (version && version !== doc.current_version) {
    const db = createServiceClient()
    const { data: ver } = await db
      .from("document_versions")
      .select("storage_path")
      .eq("organization_id", organizationId)
      .eq("document_id", documentId)
      .eq("version", version)
      .maybeSingle()
    if (!ver) return null
    path = ver.storage_path
  }

  const db = createServiceClient()
  const { data, error } = await db.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, SIGNED_DOWNLOAD_TTL)
  if (error || !data) {
    console.log("[v0] getDownloadUrl failed:", error?.message)
    throw new Error("failed to create download url")
  }
  return { url: data.signedUrl, document: doc }
}

/** Delete a document: remove all storage objects, the row (cascades versions), and the search entry. */
export async function deleteDocument(
  organizationId: string,
  documentId: string,
): Promise<boolean> {
  const db = createServiceClient()

  // Collect every version path to purge from storage.
  const { data: versions } = await db
    .from("document_versions")
    .select("storage_path")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)

  const paths = (versions ?? []).map((v) => v.storage_path).filter(Boolean)
  if (paths.length > 0) {
    const { error: rmErr } = await db.storage.from(DOCUMENT_BUCKET).remove(paths)
    if (rmErr) console.log("[v0] deleteDocument storage remove failed:", rmErr.message)
  }

  const { data, error } = await db
    .from("documents")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .select("id")
  if (error) {
    console.log("[v0] deleteDocument failed:", error.message)
    throw new Error("failed to delete document")
  }
  const deleted = (data ?? []).length > 0
  if (deleted) {
    try {
      await removeDocument(organizationId, "document", documentId)
    } catch (e) {
      console.log("[v0] deleteDocument search cleanup failed:", (e as Error).message)
    }
  }
  return deleted
}

/** Index a document record for universal search (best-effort). */
async function indexDocumentRecord(doc: DocumentRecord): Promise<void> {
  if (doc.status !== "ready") return
  try {
    await indexDocument({
      organizationId: doc.organization_id,
      resourceType: "document",
      resourceId: doc.id,
      title: doc.name,
      body: doc.description ?? "",
      url: `/documents/${doc.id}`,
      metadata: { tags: doc.tags, mimeType: doc.mime_type },
    })
  } catch (e) {
    console.log("[v0] indexDocumentRecord failed:", (e as Error).message)
  }
}
