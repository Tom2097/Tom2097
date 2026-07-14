import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractFields, INVOICE_SCHEMA, CONTRACT_SCHEMA } from '@/lib/extraction/engine'

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { documentId, content } = (await request.json()) as { documentId?: string; content?: string }
  if (!documentId || !content) {
    return NextResponse.json({ error: 'documentId and content are required' }, { status: 400 })
  }

  try {
    const db = createServiceClient()
    const { data: doc } = await db
      .from('documents')
      .select('classification')
      .eq('id', documentId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle()

    // Only invoice/contract schemas exist today -- pick by stored
    // classification, defaulting to invoice for anything else.
    const schema = doc?.classification === 'legal' ? CONTRACT_SCHEMA : INVOICE_SCHEMA
    const fields = await extractFields(content.slice(0, 10000), schema)

    await db
      .from('documents')
      .update({ extracted_entities: fields as unknown as Record<string, unknown> })
      .eq('id', documentId)
      .eq('organization_id', ctx.organizationId)

    return NextResponse.json({ success: true, data: { fields, schema: schema.name } })
  } catch (error) {
    console.error('[v1/operations/extract] error:', error)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
