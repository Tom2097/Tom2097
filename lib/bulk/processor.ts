import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import { extractFields, INVOICE_SCHEMA } from "@/lib/extraction/engine"

export const BULK_BUCKET = "bulk-uploads"

// Text formats we can actually decode and run extraction against. Anything
// else (PDF, images) needs an OCR step this codebase doesn't have -- those
// fail honestly instead of faking a result.
const TEXT_MIME_TYPES = ["text/plain", "text/csv", "application/json"]

export interface BatchFile {
  name: string
  size: number
  type: string
}

export interface BatchJob {
  id: string
  orgId: string
  files: BatchFile[]
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  createdAt: string
  completedAt?: string
  errorCount: number
}

export interface BatchResult {
  fileName: string
  status: "success" | "error"
  extractedData?: Record<string, unknown>
  error?: string
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").trim() || "file"
}

export async function createBatchJob(
  organizationId: string,
  userId: string,
  files: BatchFile[],
): Promise<{ job: BatchJob; uploads: Array<{ fileId: string; name: string; signedUrl: string; storagePath: string }> }> {
  const db = createServiceClient()

  const { data: jobRow, error: jobError } = await db
    .from("bulk_jobs")
    .insert({ organization_id: organizationId, status: "pending", created_by: userId })
    .select("*")
    .single()
  if (jobError || !jobRow) throw new Error("Failed to create batch job")

  const uploads: Array<{ fileId: string; name: string; signedUrl: string; storagePath: string }> = []
  for (const file of files) {
    const { data: fileRow, error: fileError } = await db
      .from("bulk_files")
      .insert({ job_id: jobRow.id, name: file.name, size_bytes: file.size, mime_type: file.type || "application/octet-stream", status: "pending" })
      .select("*")
      .single()
    if (fileError || !fileRow) continue

    const storagePath = `${organizationId}/${jobRow.id}/${fileRow.id}-${sanitizeName(file.name)}`
    await db.from("bulk_files").update({ storage_path: storagePath }).eq("id", fileRow.id)

    const { data: signed, error: signErr } = await db.storage.from(BULK_BUCKET).createSignedUploadUrl(storagePath)
    if (signErr || !signed) continue

    uploads.push({ fileId: fileRow.id, name: file.name, signedUrl: signed.signedUrl, storagePath })
  }

  return {
    job: { id: jobRow.id, orgId: organizationId, files, status: "pending", progress: 0, createdAt: jobRow.created_at, errorCount: 0 },
    uploads,
  }
}

/** Marks a file uploaded, runs real extraction on it, and rolls the parent job's progress/status forward. */
export async function processUploadedFile(organizationId: string, jobId: string, fileId: string): Promise<void> {
  const db = createServiceClient()

  const { data: job } = await db.from("bulk_jobs").select("id").eq("id", jobId).eq("organization_id", organizationId).maybeSingle()
  if (!job) throw new Error("Batch job not found")

  const { data: file } = await db.from("bulk_files").select("*").eq("id", fileId).eq("job_id", jobId).maybeSingle()
  if (!file) throw new Error("File not found")

  await db.from("bulk_jobs").update({ status: "processing" }).eq("id", jobId)

  try {
    if (!TEXT_MIME_TYPES.includes(file.mime_type)) {
      throw new Error(`Extraction not available for ${file.mime_type} -- only plain text, CSV, and JSON are supported without an OCR pipeline`)
    }

    const { data: blob, error: downloadError } = await db.storage.from(BULK_BUCKET).download(file.storage_path)
    if (downloadError || !blob) throw new Error("Failed to read uploaded file")
    const text = await blob.text()

    const fields = await extractFields(text, INVOICE_SCHEMA)
    const extractedData = Object.fromEntries(fields.map((f) => [f.name, f.value]))

    await db.from("bulk_files").update({ status: "processed", extracted_data: extractedData, error: null }).eq("id", fileId)
  } catch (err) {
    await db.from("bulk_files").update({ status: "failed", error: err instanceof Error ? err.message : "Extraction failed" }).eq("id", fileId)
  }

  const { data: allFiles } = await db.from("bulk_files").select("status").eq("job_id", jobId)
  const rows = allFiles ?? []
  const done = rows.filter((r) => r.status === "processed" || r.status === "failed").length
  const errorCount = rows.filter((r) => r.status === "failed").length
  const allDone = done === rows.length

  await db
    .from("bulk_jobs")
    .update({
      status: allDone ? "completed" : "processing",
      error_count: errorCount,
      completed_at: allDone ? new Date().toISOString() : null,
    })
    .eq("id", jobId)
}

async function toBatchJob(db: ReturnType<typeof createServiceClient>, row: { id: string; organization_id: string; status: string; error_count: number; created_at: string; completed_at: string | null }): Promise<BatchJob> {
  const { data: files } = await db.from("bulk_files").select("name, size_bytes, mime_type, status").eq("job_id", row.id)
  const rows = files ?? []
  const done = rows.filter((f) => f.status === "processed" || f.status === "failed").length
  const progress = rows.length > 0 ? Math.round((done / rows.length) * 100) : 0

  return {
    id: row.id,
    orgId: row.organization_id,
    files: rows.map((f) => ({ name: f.name, size: f.size_bytes, type: f.mime_type })),
    status: row.status as BatchJob["status"],
    progress,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    errorCount: row.error_count,
  }
}

export async function getBatchStatus(organizationId: string, jobId: string): Promise<BatchJob | null> {
  const db = createServiceClient()
  const { data: row } = await db.from("bulk_jobs").select("*").eq("id", jobId).eq("organization_id", organizationId).maybeSingle()
  if (!row) return null
  return toBatchJob(db, row)
}

export async function listBatches(organizationId: string): Promise<BatchJob[]> {
  const db = createServiceClient()
  const { data: rows } = await db.from("bulk_jobs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
  return Promise.all((rows ?? []).map((row) => toBatchJob(db, row)))
}

export async function getBatchResults(organizationId: string, jobId: string): Promise<BatchResult[]> {
  const db = createServiceClient()
  const { data: job } = await db.from("bulk_jobs").select("id").eq("id", jobId).eq("organization_id", organizationId).maybeSingle()
  if (!job) return []

  const { data: files } = await db.from("bulk_files").select("name, status, extracted_data, error").eq("job_id", jobId)
  return (files ?? [])
    .filter((f) => f.status === "processed" || f.status === "failed")
    .map((f) => ({
      fileName: f.name,
      status: f.status === "processed" ? ("success" as const) : ("error" as const),
      extractedData: f.extracted_data ?? undefined,
      error: f.error ?? undefined,
    }))
}
