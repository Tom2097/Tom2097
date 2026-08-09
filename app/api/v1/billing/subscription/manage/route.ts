import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from '@/lib/auth/server-auth'
import {
  isWithinRefundWindow,
  getYearlyMilestone,
  acknowledgeYearlyReminder,
  cancelSubscription,
} from '@/lib/billing/subscription-lifecycle'

/**
 * The real subscription-lifecycle functions this route exposes
 * (isWithinRefundWindow, getYearlyMilestone, acknowledgeYearlyReminder,
 * cancelSubscription -- all in lib/billing/subscription-lifecycle.ts) were
 * already correct and already unit-tested, but no route ever called them --
 * the client helpers in lib/billing/subscription-lifecycle-client.ts have
 * been POSTing here since before this route existed, always 404ing. That
 * silently disabled the refund-eligibility check (the button that depends
 * on it just never rendered) and left this app with no working in-app
 * cancellation path at all -- only Stripe's external hosted portal.
 *
 * organizationId in the request body is intentionally ignored: it's always
 * derived from the authenticated session server-side, so a caller can never
 * ask about (or act on) a different org's subscription.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const body = await request.json().catch(() => ({}))
    const action = body.action as string | undefined

    switch (action) {
      case 'refund-window': {
        const withinWindow = await isWithinRefundWindow(organizationId)
        return NextResponse.json({ withinWindow })
      }
      case 'yearly-milestone': {
        const milestone = await getYearlyMilestone(organizationId)
        return NextResponse.json(milestone)
      }
      case 'acknowledge-reminder': {
        await requireOwnerRole(user.id)
        await acknowledgeYearlyReminder(organizationId)
        return NextResponse.json({ success: true })
      }
      case 'cancel': {
        await requireOwnerRole(user.id)
        const result = await cancelSubscription(organizationId, user.id)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
