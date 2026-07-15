import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createDeal, listDeals, updateDeal, getDeal, validateDeal } from '@/lib/crm/engine'
import { recordCrmEvent } from '@/lib/crm/smart-layer'
import type { DealStage } from '@/lib/crm/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { deals, total } = await listDeals(organizationId, {
      stage: (searchParams.get('stage') as DealStage) || undefined,
      companyId: searchParams.get('companyId') || undefined,
      contactId: searchParams.get('contactId') || undefined,
      limit: Number(searchParams.get('limit')) || 200,
      offset: Number(searchParams.get('offset')) || 0,
    })
    return NextResponse.json({ deals, total })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const input = await request.json()
    const validationError = validateDeal(input)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const deal = await createDeal(organizationId, user.id, input)
    await recordCrmEvent(organizationId, 'deal_created', { dealId: deal.id })
    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { id, ...patch } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const before = patch.stage ? await getDeal(organizationId, id) : null
    const deal = await updateDeal(organizationId, id, patch)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (patch.stage === 'won' && before?.stage !== 'won') {
      await recordCrmEvent(organizationId, 'deal_won', { dealId: deal.id })
    }
    return NextResponse.json({ deal })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
