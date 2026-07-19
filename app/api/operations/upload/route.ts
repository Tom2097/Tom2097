import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'
import { runUnderstandingAndActions } from '@/lib/document-processing/pipeline'
import { runOcr } from '@/lib/ocr/engine'
import { extractText } from 'unpdf'
import * as xlsx from 'xlsx'

export const maxDuration = 30

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_JSON_BYTES = 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 256 * 1024
const MAX_SPREADSHEET_ROWS = 10_000
const MAX_SPREADSHEET_CELLS = 100_000

const ALLOWED_FILE_TYPES: Record<string, readonly string[]> = {
  '.txt': ['text/plain', 'application/octet-stream'],
  '.md': ['text/markdown', 'text/plain', 'application/octet-stream'],
  '.json': ['application/json', 'text/json', 'text/plain', 'application/octet-stream'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
  '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
  '.pdf': ['application/pdf', 'application/octet-stream'],
  '.png': ['image/png', 'application/octet-stream'],
  '.jpg': ['image/jpeg', 'application/octet-stream'],
  '.jpeg': ['image/jpeg', 'application/octet-stream'],
  '.webp': ['image/webp', 'application/octet-stream'],
}

class UploadError extends Error {
  constructor(message: string, readonly status: 413 | 415) {
    super(message)
  }
}

function fileExtension(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] ?? ''
}

function safeFilename(name: string) {
  const basename = name.replace(/\\/g, '/').split('/').pop() || 'upload'
  const sanitized = basename
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180)
  return sanitized || 'upload'
}

function validateFile(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    throw new UploadError(`File exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit`, 413)
  }

  const extension = fileExtension(file.name)
  const allowedMimeTypes = ALLOWED_FILE_TYPES[extension]
  const mimeType = (file.type || 'application/octet-stream').toLowerCase()
  if (!allowedMimeTypes || !allowedMimeTypes.includes(mimeType)) {
    throw new UploadError('Unsupported file type', 415)
  }
}

function validateSpreadsheetSize(sheet: xlsx.WorkSheet | undefined) {
  if (!sheet?.['!ref']) return
  const range = xlsx.utils.decode_range(sheet['!ref'])
  const rows = range.e.r - range.s.r + 1
  const columns = range.e.c - range.s.c + 1
  if (rows > MAX_SPREADSHEET_ROWS || rows * columns > MAX_SPREADSHEET_CELLS) {
    throw new UploadError(
      `Spreadsheet exceeds ${MAX_SPREADSHEET_ROWS} rows or ${MAX_SPREADSHEET_CELLS} cells`,
      413
    )
  }
}

async function parseFile(file: File): Promise<{ content: string; rawData: unknown[] | null; mimeType: string; sizeBytes: number }> {
  const mimeType = file.type || 'application/octet-stream'
  const sizeBytes = file.size
  const name = file.name.toLowerCase()

  // Text-based files
  if (mimeType.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json')) {
    const text = await file.text()
    let rawData: unknown[] | null = null
    if (name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text)
        rawData = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        rawData = null
      }
    }
    return { content: text, rawData, mimeType: mimeType || 'text/plain', sizeBytes }
  }

  // CSV
  if (name.endsWith('.csv')) {
    const text = await file.text()
    // A naive `row.split(',')` breaks on quoted fields that contain commas
    // (or embedded newlines/escaped quotes), silently shifting every column
    // after one and corrupting the stats generate-report computes from
    // raw_data. xlsx is already a dependency (used for the Excel branch
    // below) and its CSV reader is quote-aware, so reuse it here instead of
    // pulling in a new parsing library for this one file.
    const workbook = xlsx.read(text, { type: 'string' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    validateSpreadsheetSize(firstSheet)
    const data = firstSheet ? xlsx.utils.sheet_to_json(firstSheet, { defval: '' }) : []
    return { content: text, rawData: data, mimeType: 'text/csv', sizeBytes }
  }

  // Excel
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    validateSpreadsheetSize(firstSheet)
    const data = firstSheet ? xlsx.utils.sheet_to_json(firstSheet) : []
    return { content: '', rawData: data, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes }
  }

  // PDF
  if (name.endsWith('.pdf') || mimeType === 'application/pdf') {
    const buffer = await file.arrayBuffer()
    try {
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
      return { content: text, rawData: null, mimeType: 'application/pdf', sizeBytes }
    } catch {
      // Scanned/image-only PDFs have no extractable text layer -- still
      // record the file, just without content to analyze.
      return { content: '', rawData: null, mimeType: 'application/pdf', sizeBytes }
    }
  }

  // Allowed images are binary. Decoding them
  // via file.text() would corrupt it and can embed NUL bytes that Postgres
  // text columns reject outright, so just record it without extracted content.
  return { content: '', rawData: null, mimeType: mimeType || 'application/octet-stream', sizeBytes }
}

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    if (!ctx?.organizationId || !ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''
    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength)) {
      const requestLimit = contentType.includes('multipart/form-data') ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES
      if (contentLength > requestLimit) {
        return NextResponse.json({ error: 'Request payload too large' }, { status: 413 })
      }
    }
    const db = createServiceClient()

    let name: string
    let type = 'document'
    let content = ''
    let rawData: unknown[] | null = null
    let mimeType = 'text/plain'
    let sizeBytes = 0
    let metadata: Record<string, unknown> = { source: 'operations_upload' }
    let fileBuffer: Buffer | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      validateFile(file)
      name = safeFilename(file.name)
      const parsed = await parseFile(file)
      content = parsed.content
      rawData = parsed.rawData
      mimeType = parsed.mimeType
      sizeBytes = parsed.sizeBytes
      metadata = { source: 'operations_upload', filename: name, mime_type: mimeType }
      // File/Blob can be read more than once -- safe to read again here for
      // the raw bytes now that parseFile() has already consumed it for text.
      fileBuffer = Buffer.from(await file.arrayBuffer())
    } else if (contentType.includes('application/json')) {
      const body = await request.json()
      if (!body.text || !body.name) {
        return NextResponse.json({ error: 'text and name are required' }, { status: 400 })
      }
      name = body.name
      content = String(body.text)
      type = 'text'
      sizeBytes = new TextEncoder().encode(content).length
      if (sizeBytes > MAX_JSON_BYTES) {
        return NextResponse.json({ error: 'Text payload too large' }, { status: 413 })
      }
      name = safeFilename(String(body.name))
      metadata = { source: 'operations_upload', input_type: 'text' }
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
    }

    const insert: Record<string, unknown> = {
      organization_id: ctx.organizationId,
      name,
      type,
      content,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      storage_path: '',
      metadata,
      uploaded_by: ctx.userId,
    }

    if (rawData && rawData.length > 0) {
      insert.raw_data = rawData
    }

    const { data: doc, error } = await db
      .from('documents')
      .insert(insert)
      .select('id, name, type, mime_type, size_bytes, created_at, content, raw_data, metadata')
      .single()

    if (error) {
      console.error('[operations/upload] insert failed:', error)
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
    }

    // Persist the raw bytes to Supabase Storage so OCR (which reads via a
    // signed URL) has something to read, and so the file itself is
    // retrievable later -- storage_path was previously always empty.
    let storagePath: string | undefined
    if (fileBuffer) {
      storagePath = `${ctx.organizationId}/${doc.id}/${name}`
      const { error: storageError } = await db.storage
        .from('documents')
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true })
      if (storageError) {
        console.error('[operations/upload] storage upload failed:', storageError)
        storagePath = undefined
      } else {
        await db.from('documents').update({ storage_path: storagePath }).eq('id', doc.id)
      }
    }

    // Scanned/photographed images have no text from parseFile() -- run real
    // OCR (degrades to null gracefully if OCR_API_KEY isn't configured).
    if (storagePath && mimeType.startsWith('image/') && !content.trim()) {
      const ocrResult = await runOcr(doc.id, ctx.organizationId).catch(() => null)
      if (ocrResult?.text) content = ocrResult.text
    }

    let pipelineResult: Awaited<ReturnType<typeof runUnderstandingAndActions>> | undefined

    if (content.trim()) {
      const rateLimited = await checkTenantRateLimit(ctx.tenantId, 200, 20)
      if (rateLimited) return rateLimited

      pipelineResult = await runUnderstandingAndActions(ctx.organizationId, doc.id, content, name, ctx.userId)
    }

    const responseDoc = {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      file_size: doc.size_bytes,
      size_bytes: doc.size_bytes,
      created_at: doc.created_at,
      mime_type: doc.mime_type,
      analysis: pipelineResult?.analysis,
      classification: pipelineResult?.classification,
    }

    return NextResponse.json({ success: true, document: responseDoc, document_id: doc.id })
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[operations/upload] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
