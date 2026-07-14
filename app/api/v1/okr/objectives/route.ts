import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createObjective } from '@/lib/analytics/okr'

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    name?: string
    category?: string
    owner?: string
    start_date?: string
    end_date?: string
  }
  if (!body.name || !body.start_date || !body.end_date) {
    return NextResponse.json({ error: 'name, start_date, and end_date are required' }, { status: 400 })
  }

  const objective = await createObjective(
    ctx.organizationId,
    { name: body.name, category: body.category, owner: body.owner, start_date: body.start_date, end_date: body.end_date },
    ctx.userId,
  )
  if (!objective) {
    return NextResponse.json({ error: 'Failed to create objective' }, { status: 500 })
  }

  return NextResponse.json({ success: true, objective })
}
