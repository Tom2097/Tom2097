import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { ingestUrl } from '@/lib/operational/intake'
import { runUnderstandingAndActions } from '@/lib/document-processing/pipeline'

export const maxDuration = 30

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url } = (await request.json()) as { url?: string }
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const rateLimited = await checkTenantRateLimit(ctx.tenantId, 200, 20)
  if (rateLimited) return rateLimited

  const documentId = await ingestUrl(ctx.organizationId, url)
  if (!documentId) {
    return NextResponse.json({ error: 'Failed to fetch or save the URL' }, { status: 500 })
  }

  const db = createServiceClient()
  const { data: doc } = await db
    .from('documents')
    .select('id, name, content')
    .eq('id', documentId)
    .single()

  let pipelineResult: Awaited<ReturnType<typeof runUnderstandingAndActions>> | undefined
  if (doc?.content?.trim()) {
    pipelineResult = await runUnderstandingAndActions(ctx.organizationId, documentId, doc.content, doc.name, ctx.userId)
  }

  return NextResponse.json({
    success: true,
    document_id: documentId,
    analysis: pipelineResult?.analysis,
    classification: pipelineResult?.classification,
  })
}
