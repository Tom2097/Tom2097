import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createBooking } from '@/lib/resources/booking'

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    resource_id?: string
    resource_type?: string
    title?: string
    start_time?: string
    end_time?: string
  }
  if (!body.resource_id || !body.resource_type || !body.title || !body.start_time || !body.end_time) {
    return NextResponse.json({ error: 'resource_id, resource_type, title, start_time, and end_time are required' }, { status: 400 })
  }

  const booking = await createBooking(ctx.organizationId, {
    organization_id: ctx.organizationId,
    resource_id: body.resource_id,
    resource_type: body.resource_type,
    title: body.title,
    start_time: body.start_time,
    end_time: body.end_time,
    status: 'confirmed',
    booked_by: ctx.userId,
  })

  if (!booking) {
    return NextResponse.json({ error: 'That resource is already booked in this time window' }, { status: 409 })
  }

  return NextResponse.json({ success: true, booking })
}
