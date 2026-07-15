import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getPlanById } from '@/lib/products'
import { executePlanChange } from '@/lib/billing/proration'

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { planId } = (await request.json()) as { planId?: string }
    if (!planId || !getPlanById(planId)) {
      return NextResponse.json({ error: 'A valid planId is required' }, { status: 400 })
    }

    const result = await executePlanChange(organizationId, planId)
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to change plan' }, { status: 400 })
    }

    return NextResponse.json({ success: true, proration: result.proration })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
