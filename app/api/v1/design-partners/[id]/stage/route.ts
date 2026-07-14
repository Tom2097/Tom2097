import { NextResponse } from 'next/server'
import { updatePartnerStage, type DesignPartnerStage } from '@/lib/design-partner/partners'

const VALID_STAGES: DesignPartnerStage[] = ["awareness", "evaluation", "pilot", "launch", "advocate"]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { stage } = (await request.json()) as { stage: string }

    if (!VALID_STAGES.includes(stage as DesignPartnerStage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    const partner = updatePartnerStage(id, stage as DesignPartnerStage)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    return NextResponse.json({ partner })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update stage'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
