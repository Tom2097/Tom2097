import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getFoundingPlans, listActiveTrials, getTrialAnalytics } from '@/lib/billing/trials'
import { validateDiscountCode } from '@/lib/billing/discounts'

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
    // Ensures the caller belongs to an org; the DB-backed validator below
    // doesn't need the org id since redemption isn't claimed here (see
    // lib/billing/discounts.ts -- recordDiscountUse() is only called once a
    // payment is actually confirmed, from the Stripe webhook).
    await getOrganizationId(user.id)
    const { code, plan } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Discount code is required' }, { status: 400 })
    }
    // Use the real DB-backed discount_codes validator (lib/billing/discounts.ts)
    // instead of lib/billing/trials.ts's in-memory validateDiscountCode/
    // applyDiscountCode, which was a separate, broken implementation: its
    // applicablePlans were keyed on made-up trial plan ids rather than the
    // real starter/professional/enterprise ids, so it always rejected real
    // plans, and its usage counter reset every cold start.
    const validation = await validateDiscountCode(code, plan || '')
    if (!validation.valid || !validation.discount) {
      return NextResponse.json({ valid: false, reason: validation.error }, { status: 400 })
    }
    return NextResponse.json({ valid: true, discount: validation.discount.value })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
