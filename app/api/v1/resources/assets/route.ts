import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createAsset, type AssetNode } from '@/lib/resources/assets'

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as Partial<AssetNode>
  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const asset = await createAsset(ctx.organizationId, body, ctx.userId)
  if (!asset) {
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }

  return NextResponse.json({ success: true, asset })
}
