import { NextResponse } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { listPartners, createPartner, type DesignPartnerStage } from '@/lib/design-partner/partners'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const partners = await listPartners()
    return NextResponse.json({ partners })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const body = (await request.json()) as {
      name?: string; company?: string; email?: string; vertical?: string
    }
    if (!body.name?.trim() || !body.company?.trim() || !body.email?.trim()) {
      return NextResponse.json({ error: 'name, company, and email are required' }, { status: 400 })
    }

    const partner = await createPartner({
      name: body.name.trim(),
      company: body.company.trim(),
      email: body.email.trim(),
      stage: 'awareness' as DesignPartnerStage,
      vertical: body.vertical?.trim() ?? '',
      feedbackScore: 0,
      lastTouchpoint: new Date().toISOString().split('T')[0],
      notes: '',
    })
    if (!partner) {
      return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 })
    }
    return NextResponse.json({ partner }, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
