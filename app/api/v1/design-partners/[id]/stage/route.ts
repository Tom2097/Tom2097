import { NextResponse } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { updatePartnerStage, type DesignPartnerStage } from '@/lib/design-partner/partners'

const VALID_STAGES: DesignPartnerStage[] = ["awareness", "evaluation", "pilot", "launch", "advocate"]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const { id } = await params
    const { stage } = (await request.json()) as { stage: string }

    if (!VALID_STAGES.includes(stage as DesignPartnerStage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    const partner = await updatePartnerStage(id, stage as DesignPartnerStage)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    return NextResponse.json({ partner })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
