import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateSummary } from '@/lib/analytics/nlp'

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
    const result = await generateSummary(content.slice(0, 15000))
    const db = createServiceClient()
    const { data: existing } = await db
      .from('documents')
      .select('metadata')
      .eq('id', documentId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle()

    await db
      .from('documents')
      .update({ metadata: { ...(existing?.metadata as Record<string, unknown> ?? {}), summary: result.summary, key_points: result.keyPoints } })
      .eq('id', documentId)
      .eq('organization_id', ctx.organizationId)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[v1/operations/summarize] error:', error)
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 })
  }
}
