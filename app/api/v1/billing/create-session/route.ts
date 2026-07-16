import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId } from '@/lib/auth/server-auth'
import { getPlanById } from '@/lib/products'
import { createRazorpaySession } from '@/lib/billing/razorpay'
import { getRequestOrigin } from '@/lib/http/request-origin'

// Browser-navigated (window.location.href), not fetch()'d -- responds with
// a redirect rather than JSON, either to the Razorpay hosted checkout page
// or back to pricing with an error flag.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const origin = getRequestOrigin(request)
  const planId = searchParams.get('plan')
  const redirectPath = searchParams.get('redirect') || '/settings'

  const plan = planId ? getPlanById(planId) : undefined
  if (!plan) {
    return NextResponse.redirect(`${origin}/pricing?error=invalid_plan`)
  }

  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const checkoutUrl = await createRazorpaySession(
      organizationId,
      user.id,
      {
        id: plan.id as 'free' | 'pro' | 'enterprise',
        name: plan.name,
        price: plan.priceInr,
        currency: 'INR',
        billingPeriod: plan.interval === 'year' ? 'yearly' : 'monthly',
        features: plan.features,
      },
      `${origin}${redirectPath}`,
      `${origin}/pricing?canceled=true`,
    )

    if (!checkoutUrl) {
      return NextResponse.redirect(`${origin}/pricing?error=checkout_failed`)
    }

    return NextResponse.redirect(checkoutUrl)
  } catch {
    return NextResponse.redirect(`${origin}/auth/login?redirect=/pricing`)
  }
}
