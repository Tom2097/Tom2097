import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isStripeConfigured } from '@/lib/billing/stripe'

export async function POST(request: Request) {
  try {
    const { userId, email, fullName, companyName } = await request.json()
    const supabase = await createServiceClient()

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: companyName,
        email,
        created_by: userId,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      throw new Error(orgError?.message || 'Failed to create organization')
    }

    // Create subscription with trial (skip Stripe if not configured)
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        organization_id: org.id,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_customer_id: isStripeConfigured() ? "pending" : undefined,
        created_by: userId,
      })

    if (subError) {
      throw new Error(subError.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[create-trial] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create trial' },
      { status: 500 }
    )
  }
}