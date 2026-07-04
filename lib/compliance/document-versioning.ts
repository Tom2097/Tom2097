import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export interface DocumentVersion {
  id: string
  organization_id: string
  document_id: string
  version: number
  content_hash: string
  content: string | null
  storage_path: string | null
  mime_type: string | null
  size_bytes: number
  change_summary: string | null
  created_by: string | null
  created_at: string
}

export interface VersionDiff {
  version: number
  added: string[]
  removed: string[]
  changed: Array<{ field: string; from: string; to: string }>
}

export async function createDocumentVersion(
  organizationId: string,
  documentId: string,
  content: string,
  createdBy: string | null,
  changeSummary: string | null = null,
): Promise<DocumentVersion | null> {
  const db = createServiceClient()

  const { data: currentDoc } = await db
    .from("documents")
    .select("current_version, content, name")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .single()

  if (!currentDoc) return null

  const currentVersion = currentDoc.current_version || 0
  const newVersion = currentVersion + 1
  const contentHash = createHash("sha256").update(content).digest("hex")

  const { data, error } = await db.from("document_versions").insert({
    organization_id: organizationId,
    document_id: documentId,
    version: newVersion,
    content_hash: contentHash,
    content,
    mime_type: "text/plain",
    size_bytes: content.length,
    change_summary: changeSummary,
    created_by: createdBy,
  }).select("*").single()

  if (error) return null

  await db.from("documents").update({
    current_version: newVersion,
    content,
    updated_at: new Date().toISOString(),
  }).eq("id", documentId)

  await publish({
    type: "document.version_created",
    organization_id: organizationId,
    data: { document_id: documentId, version: newVersion, change_summary: changeSummary },
  })

  return data as DocumentVersion
}

export async function getDocumentVersions(
  organizationId: string,
  documentId: string,
): Promise<DocumentVersion[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("document_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .order("version", { ascending: false })

  return (data ?? []) as DocumentVersion[]
}

export async function getDocumentVersion(
  organizationId: string,
  documentId: string,
  version: number,
): Promise<DocumentVersion | null> {
  const db = createServiceClient()
  const { data } = await db
    .from("document_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .eq("version", version)
    .maybeSingle()

  return (data as DocumentVersion) ?? null
}

export async function diffVersions(
  organizationId: string,
  documentId: string,
  v1: number,
  v2: number,
): Promise<VersionDiff | null> {
  const [a, b] = await Promise.all([
    getDocumentVersion(organizationId, documentId, v1),
    getDocumentVersion(organizationId, documentId, v2),
  ])

  if (!a || !b) return null

  const added: string[] = []
  const removed: string[] = []
  const changed: Array<{ field: string; from: string; to: string }> = []

  const linesA = (a.content || "").split("\n")
  const linesB = (b.content || "").split("\n")

  for (const line of linesB) {
    if (!linesA.includes(line)) added.push(line.trim())
  }
  for (const line of linesA) {
    if (!linesB.includes(line)) removed.push(line.trim())
  }

  return { version: v2, added, removed, changed }
}

export async function restoreDocumentVersion(
  organizationId: string,
  documentId: string,
  version: number,
  restoredBy: string | null,
): Promise<DocumentVersion | null> {
  const versionDoc = await getDocumentVersion(organizationId, documentId, version)
  if (!versionDoc || !versionDoc.content) return null

  return createDocumentVersion(
    organizationId,
    documentId,
    versionDoc.content,
    restoredBy,
    `Restored from version ${version}`,
  )
}

export async function deleteOldVersions(
  organizationId: string,
  documentId: string,
  keepLast: number = 10,
): Promise<number> {
  const db = createServiceClient()
  const versions = await getDocumentVersions(organizationId, documentId)

  if (versions.length <= keepLast) return 0

  const toDelete = versions.slice(keepLast)
  const ids = toDelete.map((v) => v.id)

  const { error } = await db
    .from("document_versions")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", ids)

  if (error) return 0
  return toDelete.length
}
