import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context'
import { classifyText, extractEntities } from '@/lib/analytics/nlp'
import { dispatchDocumentEvent } from '@/lib/documents/events'
import { populateCrmFromExtraction } from '@/lib/documents/populate-crm'

function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes
      else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = '' }
      else current += ch
    }
    values.push(current.trim())
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? null })
    return row
  })
}

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
    }

    const contentType = request.headers.get('content-type') || ''

    let name = ''
    let fileType = ''
    let content = ''
    let rawData: Record<string, unknown>[] | null = null
    let fileSize = 0

    if (contentType.includes('multipart/form-data')) {
      let formData: FormData
      try {
        formData = await request.formData()
      } catch (e) {
        console.error('[upload] formData() failed:', e)
        return NextResponse.json({ error: 'Failed to parse upload' }, { status: 400 })
      }
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      let arrayBuffer: ArrayBuffer
      try {
        arrayBuffer = await file.arrayBuffer()
      } catch (e) {
        console.error('[upload] arrayBuffer() failed:', e)
        return NextResponse.json({ error: 'Failed to read file' }, { status: 400 })
      }
      name = file.name
      fileType = file.type || name.split('.').pop()?.toLowerCase() || 'unknown'
      fileSize = file.size

      try {
        content = new TextDecoder().decode(arrayBuffer)
      } catch (e) {
        console.error('[upload] TextDecoder failed:', e)
        return NextResponse.json({ error: 'Failed to decode file' }, { status: 400 })
      }

      // Parse CSV manually — no eval-heavy libraries
      if (fileType === 'text/csv' || name.endsWith('.csv')) {
        try {
          rawData = parseCSV(content)
        } catch (e) {
          console.error('[upload] CSV parse failed, keeping as text:', e)
        }
      }
    } else {
      let body: { text?: string; name?: string }
      try {
        body = await request.json()
      } catch (e) {
        console.error('[upload] JSON parse failed:', e)
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      if (!body.text || !body.name) {
        return NextResponse.json({ error: 'Text content and name required' }, { status: 400 })
      }
      name = body.name
      fileType = 'text'
      content = body.text
      fileSize = new TextEncoder().encode(body.text).length
    }

    let doc: Record<string, unknown> | null = null
    try {
      const supabase = createServiceClient()
      const result = await supabase
        .from('documents')
        .insert({
          organization_id: orgId,
          name,
          type: fileType,
          content,
          raw_data: rawData,
          file_size: fileSize,
        })
        .select('id, name, type, file_size, created_at')
        .single()
      doc = result.data
      if (result.error) {
        throw new Error(result.error.message)
      }
    } catch (e: unknown) {
      console.error('[upload] DB insert failed:', e)
      throw e
    }

    // Auto-classify document content
    const classificationPromise =
      content && content.length < 50000
        ? classifyText(content.slice(0, 10000)).then(async (result) => {
            const supabase = createServiceClient()
            await supabase.from("documents").update({ classification: result.primary }).eq("id", doc?.id)
          }).catch(() => {})
        : Promise.resolve()

    // Extract entities from content for CRM population
    const entitiesPromise =
      content && content.length < 50000
        ? extractEntities(content.slice(0, 10000)).then(async (result) => {
            if (result.entities.length > 0) {
              const supabase = createServiceClient()
              await supabase.from("documents").update({ extracted_entities: result }).eq("id", doc?.id)
              // Auto-populate CRM contacts/companies from extracted entities
              await populateCrmFromExtraction(orgId, doc?.id as string, result).catch(() => {})
            }
          }).catch(() => {})
        : Promise.resolve()

    await Promise.allSettled([classificationPromise, entitiesPromise])

    // Dispatch creation event
    dispatchDocumentEvent({
      type: "document.created",
      organization_id: orgId,
      document_id: doc?.id as string,
      actor_id: null,
      metadata: { name, fileType, fileSize, classification: doc?.classification ?? null },
    }).catch(() => {})

    return NextResponse.json({ success: true, document: doc })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to upload document'
    const stack = error instanceof Error ? error.stack : ''
    console.error('[upload] Unhandled error:', msg, stack)
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}