import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getFoundingPlans, validateDiscountCode, applyDiscountCode, listActiveTrials, getTrialAnalytics } from '@/lib/billing/trials'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)
    const [foundingPlans, activeTrials, analytics] = await Promise.all([
      Promise.resolve(getFoundingPlans()),
      Promise.resolve(listActiveTrials()),
      Promise.resolve(getTrialAnalytics()),
    ])
    return NextResponse.json({ foundingPlans, activeTrials, analytics })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { code, plan } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Discount code is required' }, { status: 400 })
    }
    const validation = await validateDiscountCode(code, plan || '')
    if (!validation.valid) {
      return NextResponse.json({ valid: false, reason: validation.reason }, { status: 400 })
    }
    const discount = applyDiscountCode(organizationId, code)
    return NextResponse.json({ valid: true, discount })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
