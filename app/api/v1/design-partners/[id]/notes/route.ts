import { NextResponse } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { updatePartnerNotes } from '@/lib/design-partner/partners'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const { id } = await params
    const { notes } = (await request.json()) as { notes: string }

    if (!notes || typeof notes !== 'string') {
      return NextResponse.json({ error: 'Notes are required' }, { status: 400 })
    }

    const partner = await updatePartnerNotes(id, notes.trim())
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    return NextResponse.json({ partner })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
