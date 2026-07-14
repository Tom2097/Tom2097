import { NextResponse } from 'next/server'
import { updatePartnerNotes } from '@/lib/design-partner/partners'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { notes } = (await request.json()) as { notes: string }

    if (!notes || typeof notes !== 'string') {
      return NextResponse.json({ error: 'Notes are required' }, { status: 400 })
    }

    const partner = updatePartnerNotes(id, notes.trim())
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    return NextResponse.json({ partner })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save notes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
