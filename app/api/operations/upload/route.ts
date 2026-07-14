import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'
import { analyzeDocument } from '@/lib/document-processing/analyze'
import { extractText } from 'unpdf'
import * as xlsx from 'xlsx'

export const maxDuration = 30

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
    const rows = text.split(/\r?\n/).filter(Boolean)
    if (rows.length === 0) return { content: text, rawData: [], mimeType: 'text/csv', sizeBytes }
    const headers = rows[0].split(',').map(h => h.trim())
    const data = rows.slice(1).map(row => {
      const values = row.split(',')
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = values[i]?.trim() ?? '' })
      return obj
    })
    return { content: text, rawData: data, mimeType: 'text/csv', sizeBytes }
  }

  // Excel
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = xlsx.utils.sheet_to_json(firstSheet)
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

  // Fallback: anything else (images, docx, zip, ...) is binary. Decoding it
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
    const db = createServiceClient()

    let name: string
    let type = 'document'
    let content = ''
    let rawData: unknown[] | null = null
    let mimeType = 'text/plain'
    let sizeBytes = 0
    let metadata: Record<string, unknown> = { source: 'operations_upload' }

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      name = file.name
      const parsed = await parseFile(file)
      content = parsed.content
      rawData = parsed.rawData
      mimeType = parsed.mimeType
      sizeBytes = parsed.sizeBytes
      metadata = { source: 'operations_upload', filename: file.name, mime_type: mimeType }
    } else if (contentType.includes('application/json')) {
      const body = await request.json()
      if (!body.text || !body.name) {
        return NextResponse.json({ error: 'text and name are required' }, { status: 400 })
      }
      name = body.name
      content = String(body.text)
      type = 'text'
      sizeBytes = new TextEncoder().encode(content).length
      metadata = { source: 'operations_upload', input_type: 'text' }
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
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

    let analysis: Record<string, unknown> | undefined

    if (content.trim()) {
      const rateLimited = await checkTenantRateLimit(ctx.tenantId, 200, 20)
      if (rateLimited) return rateLimited

      try {
        analysis = await analyzeDocument(content, name)
      } catch (analysisError) {
        console.error('[operations/upload] analysis failed:', analysisError)
        analysis = { status: 'failed' }
      }

      await db
        .from('documents')
        .update({ metadata: { ...(doc.metadata as Record<string, unknown>), analysis } })
        .eq('id', doc.id)
    }

    const responseDoc = {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      file_size: doc.size_bytes,
      size_bytes: doc.size_bytes,
      created_at: doc.created_at,
      mime_type: doc.mime_type,
      analysis,
    }

    return NextResponse.json({ success: true, document: responseDoc, document_id: doc.id })
  } catch (error) {
    console.error('[operations/upload] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
