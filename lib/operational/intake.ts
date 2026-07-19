import { createServiceClient } from "@/lib/supabase/service"
import { classifyText } from "@/lib/analytics/nlp"
import { dispatchDocumentEvent } from "@/lib/documents/events"
import { runOcr } from "@/lib/ocr/engine"
import { assertPublicHttpUrl } from "@/lib/security/url-guard"

type IntakeSource = "email" | "voice" | "photo" | "audio" | "url" | "bulk" | "manual"

export async function ingestFromEmail(
  organizationId: string,
  from: string, subject: string, body: string, attachments?: Array<{ name: string; content: string }>,
): Promise<string[]> {
  const db = createServiceClient()
  const docIds: string[] = []

  const { data: doc } = await db.from("documents").insert({
    organization_id: organizationId, name: `Email: ${subject}`, type: "email",
    content: body, metadata: { source: "email", from, subject },
  }).select("id").single()
  if (doc) {
    docIds.push(doc.id as string)
    const result = await classifyText(body.slice(0, 5000)).catch(() => null)
    await dispatchDocumentEvent({
      type: "document.created", organization_id: organizationId,
      document_id: doc.id as string, actor_id: null,
      metadata: { source: "email", classification: result?.primary ?? null },
    })
  }

  if (attachments) {
    for (const att of attachments) {
      const { data: attDoc } = await db.from("documents").insert({
        organization_id: organizationId, name: att.name, type: "attachment",
        content: att.content, metadata: { source: "email_attachment", from },
      }).select("id").single()
      if (attDoc) docIds.push(attDoc.id as string)
    }
  }

  return docIds
}

export async function ingestVoiceNote(
  organizationId: string, transcript: string, fileName: string,
): Promise<string | null> {
  const db = createServiceClient()
  const { data: doc } = await db.from("documents").insert({
    organization_id: organizationId, name: fileName, type: "voice_transcript",
    content: transcript, metadata: { source: "voice_note" },
  }).select("id").single()
  if (doc) {
    await dispatchDocumentEvent({
      type: "document.created", organization_id: organizationId,
      document_id: doc.id as string, actor_id: null,
      metadata: { source: "voice_note" },
    })
    return doc.id as string
  }
  return null
}

export async function ingestPhotoOcr(
  organizationId: string, fileName: string, storagePath: string,
): Promise<string | null> {
  const db = createServiceClient()
  const { data: doc } = await db.from("documents").insert({
    organization_id: organizationId, name: fileName, type: "scan",
    storage_path: storagePath, mime_type: "image/png",
    metadata: { source: "photo_scan", needs_ocr: true },
  }).select("id").single()
  if (doc) {
    const docId = doc.id as string
    // Fire-and-forget OCR processing
    runOcr(docId, organizationId).catch(() => {})
    return docId
  }
  return null
}

export async function ingestUrl(
  organizationId: string, url: string,
): Promise<string | null> {
  try {
    const safeUrl = await assertPublicHttpUrl(url)
    const res = await fetch(safeUrl, { signal: AbortSignal.timeout(15000), redirect: "error" })
    const html = await res.text()
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50000)
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? url

    const db = createServiceClient()
    const { data: doc } = await db.from("documents").insert({
      organization_id: organizationId, name: `Web: ${title}`, type: "web_clip",
      content: text, metadata: { source: "url_clip", url },
    }).select("id").single()
    if (doc) return doc.id as string
  } catch {}
  return null
}

export async function bulkDrop(
  organizationId: string, files: Array<{ name: string; content: string; type: string }>,
): Promise<string[]> {
  const results: string[] = []
  for (const file of files) {
    const db = createServiceClient()
    const { data: doc } = await db.from("documents").insert({
      organization_id: organizationId, name: file.name, type: file.type,
      content: file.content, file_size: file.content.length,
      metadata: { source: "bulk_drop" },
    }).select("id").single()
    if (doc) results.push(doc.id as string)
  }
  return results
}
