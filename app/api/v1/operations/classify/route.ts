import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createServiceClient } from '@/lib/supabase/service'
import { classifyText } from '@/lib/analytics/nlp'

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
    const result = await classifyText(content.slice(0, 5000))
    const db = createServiceClient()
    await db
      .from('documents')
      .update({ classification: result.primary })
      .eq('id', documentId)
      .eq('organization_id', ctx.organizationId)

    return NextResponse.json({ success: true, data: { classification: result.primary, confidence: result.confidence } })
  } catch (error) {
    console.error('[v1/operations/classify] error:', error)
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 })
  }
}
