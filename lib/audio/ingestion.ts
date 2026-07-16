import "server-only"
import { createServiceClient } from "@/lib/supabase/service"

export const RECORDING_BUCKET = "recordings"

export interface RecordingUpload {
  id: string
  name: string
  size: number
  type: string
  status: "pending" | "uploaded" | "processing" | "ready" | "failed"
  duration?: number
  createdAt: string
}

export interface TranscriptionResult {
  recordingId: string
  text: string
  segments: { start: number; end: number; speaker: string; text: string }[]
  confidence: number
  isSimulated: boolean
}

export interface ActionItem {
  id: string
  recordingId: string
  text: string
  assignee?: string
  dueDate?: string
  status: "open" | "in_progress" | "completed"
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").trim() || "recording"
}

function toRecordingUpload(row: {
  id: string; name: string; size_bytes: number; mime_type: string
  status: string; duration_seconds: number | null; created_at: string
}): RecordingUpload {
  return {
    id: row.id,
    name: row.name,
    size: row.size_bytes,
    type: row.mime_type,
    status: row.status as RecordingUpload["status"],
    duration: row.duration_seconds ?? undefined,
    createdAt: row.created_at,
  }
}

/** Creates a pending recording row and a signed upload URL for the client to PUT bytes to. */
export async function createRecordingUpload(
  organizationId: string,
  uploadedBy: string,
  file: { name: string; size: number; type: string },
): Promise<{ recording: RecordingUpload; signedUrl: string; token: string; storagePath: string }> {
  const db = createServiceClient()

  const { data: row, error } = await db
    .from("recordings")
    .insert({
      organization_id: organizationId,
      name: file.name,
      size_bytes: file.size,
      mime_type: file.type || "audio/mpeg",
      status: "pending",
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single()
  if (error || !row) throw new Error("Failed to create recording")

  const storagePath = `${organizationId}/${row.id}/${sanitizeName(file.name)}`
  await db.from("recordings").update({ storage_path: storagePath }).eq("id", row.id)

  const { data: signed, error: signErr } = await db.storage
    .from(RECORDING_BUCKET)
    .createSignedUploadUrl(storagePath)
  if (signErr || !signed) throw new Error("Failed to create upload URL")

  return { recording: toRecordingUpload(row), signedUrl: signed.signedUrl, token: signed.token, storagePath }
}

export async function confirmRecordingUpload(
  organizationId: string,
  recordingId: string,
  durationSeconds?: number,
): Promise<RecordingUpload | null> {
  const db = createServiceClient()
  const { data: row, error } = await db
    .from("recordings")
    .update({ status: "uploaded", duration_seconds: durationSeconds ?? null, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", recordingId)
    .select("*")
    .single()
  if (error || !row) return null
  return toRecordingUpload(row)
}

/**
 * No speech-to-text provider is configured in this codebase (no API key,
 * no SDK). This generates a clearly-labeled demo transcript so the rest of
 * the UI (segments, action items) has something real to persist and
 * operate on, rather than pretending audio was actually transcribed.
 */
export async function processTranscription(organizationId: string, recordingId: string): Promise<TranscriptionResult> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from("recordings")
    .select("transcript_text, transcript_confidence, transcript_is_simulated")
    .eq("organization_id", organizationId)
    .eq("id", recordingId)
    .maybeSingle()

  if (existing?.transcript_text) {
    const { data: segRows } = await db
      .from("recording_segments")
      .select("start_seconds, end_seconds, speaker, text")
      .eq("recording_id", recordingId)
      .order("ordinal", { ascending: true })
    return {
      recordingId,
      text: existing.transcript_text,
      confidence: Number(existing.transcript_confidence ?? 0),
      isSimulated: existing.transcript_is_simulated,
      segments: (segRows ?? []).map((s) => ({ start: s.start_seconds, end: s.end_seconds, speaker: s.speaker, text: s.text })),
    }
  }

  await db.from("recordings").update({ status: "processing" }).eq("organization_id", organizationId).eq("id", recordingId)

  const speakers = ["Speaker A", "Speaker B", "Speaker C"]
  const segmentCount = 3 + (recordingId.charCodeAt(0) % 6)
  const segments = Array.from({ length: segmentCount }, (_, i) => {
    const start = i * 25
    const end = start + 15
    return { start, end, speaker: speakers[i % speakers.length], text: `Demo transcript segment ${i + 1} (no speech-to-text provider configured).` }
  })
  const confidence = 0

  await db.from("recording_segments").insert(
    segments.map((s, i) => ({
      recording_id: recordingId,
      start_seconds: s.start,
      end_seconds: s.end,
      speaker: s.speaker,
      text: s.text,
      ordinal: i,
    })),
  )

  const text = segments.map((s) => `[${s.start}s - ${s.end}s] ${s.speaker}: ${s.text}`).join("\n")

  await db
    .from("recordings")
    .update({ status: "ready", transcript_text: text, transcript_confidence: confidence, transcript_is_simulated: true })
    .eq("organization_id", organizationId)
    .eq("id", recordingId)

  return { recordingId, text, segments, confidence, isSimulated: true }
}

export async function extractActionItems(organizationId: string, recordingId: string): Promise<ActionItem[]> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from("recording_action_items")
    .select("id, text, assignee, due_date, status")
    .eq("recording_id", recordingId)

  if (existing && existing.length > 0) {
    return existing.map((i) => ({ id: i.id, recordingId, text: i.text, assignee: i.assignee ?? undefined, dueDate: i.due_date ?? undefined, status: i.status as ActionItem["status"] }))
  }

  const defaults = [
    "Review transcript and identify key decisions",
    "Follow up on action items with stakeholders",
    "Schedule next review meeting",
  ]
  const { data: inserted, error } = await db
    .from("recording_action_items")
    .insert(defaults.map((text, i) => ({ recording_id: recordingId, text, status: i === 2 ? "in_progress" : "open" })))
    .select("id, text, assignee, due_date, status")
  if (error || !inserted) return []

  return inserted.map((i) => ({ id: i.id, recordingId, text: i.text, assignee: i.assignee ?? undefined, dueDate: i.due_date ?? undefined, status: i.status as ActionItem["status"] }))
}

export async function getRecording(organizationId: string, recordingId: string): Promise<RecordingUpload | null> {
  const db = createServiceClient()
  const { data: row } = await db
    .from("recordings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", recordingId)
    .maybeSingle()
  return row ? toRecordingUpload(row) : null
}

export async function listRecordings(organizationId: string): Promise<RecordingUpload[]> {
  const db = createServiceClient()
  const { data: rows } = await db
    .from("recordings")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
  return (rows ?? []).map(toRecordingUpload)
}

async function actionItemBelongsToOrg(organizationId: string, itemId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data: item } = await db.from("recording_action_items").select("recording_id").eq("id", itemId).maybeSingle()
  if (!item) return false
  const { data: recording } = await db.from("recordings").select("id").eq("id", item.recording_id).eq("organization_id", organizationId).maybeSingle()
  return !!recording
}

export async function updateActionItemStatus(organizationId: string, itemId: string, status: ActionItem["status"]): Promise<boolean> {
  if (!(await actionItemBelongsToOrg(organizationId, itemId))) return false
  const db = createServiceClient()
  await db.from("recording_action_items").update({ status }).eq("id", itemId)
  return true
}

export async function updateActionItemAssignee(organizationId: string, itemId: string, assignee: string): Promise<boolean> {
  if (!(await actionItemBelongsToOrg(organizationId, itemId))) return false
  const db = createServiceClient()
  await db.from("recording_action_items").update({ assignee }).eq("id", itemId)
  return true
}

export async function deleteRecording(organizationId: string, recordingId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data: row } = await db
    .from("recordings")
    .select("storage_path")
    .eq("organization_id", organizationId)
    .eq("id", recordingId)
    .maybeSingle()
  if (row?.storage_path) {
    await db.storage.from(RECORDING_BUCKET).remove([row.storage_path])
  }
  const { error } = await db.from("recordings").delete().eq("organization_id", organizationId).eq("id", recordingId)
  return !error
}
