import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe'
import { addOns } from '@/lib/subscription-data'

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    await requireOwnerRole(user.id)

    const { addonId } = (await request.json()) as { addonId?: string }
    const addon = addOns.find((a) => a.id === addonId)
    if (!addon) {
      return NextResponse.json({ error: 'Unknown add-on' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('organization_id', organizationId)
      .single()

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: 'Subscribe to a plan first, then add extras.' }, { status: 400 })
    }

    const stripe = await getStripe()
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(addon.price * 100),
      recurring: { interval: 'month' },
      product_data: { name: `${addon.name} (${addon.unit})` },
    })
    await stripe.subscriptionItems.create({
      subscription: sub.stripe_subscription_id,
      price: price.id,
      quantity: 1,
    })

    await supabase.from('billing_events').insert({
      organization_id: organizationId,
      event_type: 'addon_purchased',
      provider: 'stripe',
      metadata: { addon_id: addon.id, addon_name: addon.name, price: addon.price },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
