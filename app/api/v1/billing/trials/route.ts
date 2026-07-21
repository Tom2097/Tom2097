import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { startTrial, extendTrial } from '@/lib/billing/trials'
import { createServiceClient } from '@/lib/supabase/service'

interface OrgTrial {
  orgId: string
  planId: string
  startedAt: string
  expiresAt: string
  status: 'active' | 'expired' | 'converted' | 'cancelled'
  daysRemaining: number
}

/**
 * Maps the caller's real `subscriptions` row (the source of truth billed by
 * Stripe/Razorpay) onto the OrgTrial shape app/(dashboard)/billing/plans/page.tsx
 * expects. This used to read lib/billing/trials.ts's in-process `Map`, which
 * is wiped on every server restart and was never connected to the real
 * subscription a trial signup actually creates -- the UI's trial banner
 * reflected fake state that had nothing to do with what the org was
 * entitled to.
 */
async function getRealTrialStatus(organizationId: string): Promise<OrgTrial | null> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_id, status, trial_ends_at, current_period_start')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!sub || !sub.trial_ends_at) {
    return null
  }

  let status: OrgTrial['status']
  switch (sub.status) {
    case 'trialing':
      status = 'active'
      break
    case 'expired':
      status = 'expired'
      break
    case 'active':
      status = 'converted'
      break
    case 'cancelled':
    case 'refunded':
      status = 'cancelled'
      break
    default:
      status = 'expired'
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  )

  return {
    orgId: organizationId,
    planId: sub.plan_id,
    startedAt: sub.current_period_start,
    expiresAt: sub.trial_ends_at,
    status,
    daysRemaining,
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { planId } = await request.json()
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }
    const trial = startTrial(organizationId, planId)
    return NextResponse.json({ success: true, trial })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    // Always resolve the authenticated user's own org -- an `orgId` query
    // param override here would let any authenticated user read another
    // org's trial status just by passing `?orgId=<other-org>`. No
    // platform-admin use case for this route calls it with an override, so
    // it's removed rather than gated.
    const organizationId = await getOrganizationId(user.id)
    const trial = await getRealTrialStatus(organizationId)
    return NextResponse.json({ trial })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { extraDays } = await request.json()
    if (!extraDays || typeof extraDays !== 'number') {
      return NextResponse.json({ error: 'extraDays is required and must be a number' }, { status: 400 })
    }
    const trial = extendTrial(organizationId, extraDays)
    return NextResponse.json({ success: true, trial })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
