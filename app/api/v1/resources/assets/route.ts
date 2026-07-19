import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createAsset } from '@/lib/resources/assets'

const CreateAssetSchema = z.object({
  name: z.string().trim().min(1).max(255),
  category: z.string().trim().max(100).nullable().optional().default(null),
  subcategory: z.string().trim().max(100).nullable().optional().default(null),
  parent_id: z.string().uuid().nullable().optional().default(null),
  serial_number: z.string().trim().max(255).nullable().optional().default(null),
  asset_tag: z.string().trim().max(255).nullable().optional().default(null),
  status: z.enum(['active', 'maintenance', 'retired', 'idle']).optional().default('active'),
  location: z.string().trim().max(255).nullable().optional().default(null),
  purchase_date: z.string().date().nullable().optional().default(null),
  purchase_value: z.number().nonnegative().nullable().optional().default(null),
  current_value: z.number().nonnegative().nullable().optional().default(null),
  warranty_expiry: z.string().date().nullable().optional().default(null),
  metadata: z.record(z.unknown()).optional().default({}),
}).strict()

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = CreateAssetSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid asset data', details: parsed.error.flatten() }, { status: 400 })
  }

  const asset = await createAsset(ctx.organizationId, parsed.data, ctx.userId)
  if (!asset) {
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }

  return NextResponse.json({ success: true, asset })
}
