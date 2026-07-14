import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { getDocumentFeed } from '@/lib/operational/auto-create'

export async function GET() {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await getDocumentFeed(ctx.organizationId)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[v1/operations/feed] error:', error)
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 })
  }
}
