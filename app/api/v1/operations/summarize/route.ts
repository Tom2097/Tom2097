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

    // Atomic jsonb merge (see merge_document_metadata RPC) instead of
    // read-then-write -- this route and lib/document-processing/pipeline.ts
    // both write documents.metadata, so a read-modify-write here can lose
    // concurrent updates from the other path regardless of timing.
    const { error: mergeError } = await db.rpc('merge_document_metadata', {
      p_document_id: documentId,
      p_organization_id: ctx.organizationId,
      p_patch: { summary: result.summary, key_points: result.keyPoints },
    })
    if (mergeError) {
      console.error('[v1/operations/summarize] metadata merge failed:', mergeError)
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[v1/operations/summarize] error:', error)
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 })
  }
}
