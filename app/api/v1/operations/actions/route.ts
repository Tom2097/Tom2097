import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { draftResponse, triggerAutoActions } from '@/lib/operational/actions'

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    action?: 'draft_response' | 'auto_create'
    documentId?: string
    content?: string
    classification?: string | null
  }
  const { action, documentId, content, classification } = body
  if (!action || !documentId || !content) {
    return NextResponse.json({ error: 'action, documentId, and content are required' }, { status: 400 })
  }

  try {
    if (action === 'draft_response') {
      const response = await draftResponse(ctx.organizationId, documentId, content)
      return NextResponse.json({ success: true, data: { response } })
    }

    if (action === 'auto_create') {
      if (!classification) {
        return NextResponse.json({ error: 'classification is required for auto_create' }, { status: 400 })
      }
      const result = await triggerAutoActions(ctx.organizationId, documentId, content, classification, ctx.userId)
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[v1/operations/actions] error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
