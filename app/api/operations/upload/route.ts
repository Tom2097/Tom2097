import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context'
import * as XLSX from 'xlsx'

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name
    const fileType = file.type || fileName.split('.').pop()?.toLowerCase() || 'unknown'
    const fileSize = file.size

    let content = ''
    let rawData: Record<string, unknown>[] | null = null

    if (fileType === 'text/plain' || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      content = buffer.toString('utf-8')
    } else if (
      fileType === 'text/csv' ||
      fileName.endsWith('.csv') ||
      fileType.includes('spreadsheet') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(firstSheet)
      rawData = jsonData as Record<string, unknown>[]
      content = JSON.stringify(rawData, null, 2)
    } else {
      content = buffer.toString('utf-8')
    }

    const supabase = createServiceClient()
    const { data: doc, error } = await supabase
      .from('documents')
      .insert({
        organization_id: orgId,
        name: fileName,
        type: fileType,
        content,
        raw_data: rawData,
        file_size: fileSize,
      })
      .select('id, name, type, file_size, created_at')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true, document: doc })
  } catch (error) {
    console.error('[upload] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    )
  }
}