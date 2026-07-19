"use server"

import { getStripe } from "@/lib/stripe"
import { SUBSCRIPTION_PLANS, getPlanById } from "@/lib/products"
import { createClient } from "@/lib/supabase/server"
import { validateDiscountCode, applyDiscount } from "@/lib/billing/discounts"

export async function createCheckoutSession(planId: string, discountCode?: string) {
  const stripe = await getStripe()
  const plan = getPlanById(planId)
  if (!plan) {
    throw new Error("Invalid plan selected")
  }

  // Get current user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("You must be logged in to subscribe")
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    throw new Error("No organization found")
  }

  // Validate discount code (read-only -- does NOT consume a redemption).
  // The redemption itself is claimed atomically in the Stripe webhook's
  // checkout.session.completed handler, once payment is actually confirmed,
  // so an abandoned checkout never burns a use.
  let appliedDiscount: string | undefined
  let finalPriceCents = plan.priceInCents
  if (discountCode) {
    const result = await validateDiscountCode(discountCode, planId)
    if (!result.valid) {
      throw new Error(result.error || "Invalid discount code")
    }
    if (result.discount) {
      finalPriceCents = applyDiscount(plan.priceInCents, result.discount)
      appliedDiscount = `${result.discount.value}% off (${result.discount.code})`
    }
  }

  // Check for existing subscription
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", profile.organization_id)
    .single()

  let customerId = existingSub?.stripe_customer_id

  if (!customerId) {
    // Stable per-org idempotency key: if this action is invoked twice for the
    // same org in quick succession (double submit, Stripe SDK auto-retry on
    // a network blip), Stripe returns the SAME customer instead of creating
    // a duplicate.
    const customer = await stripe.customers.create(
      {
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
          organization_id: profile.organization_id,
        },
      },
      { idempotencyKey: `stripe-customer-${profile.organization_id}` }
    )
    customerId = customer.id

    // Claim the customer id only if it's still unset, so a concurrent
    // request that already wrote a (necessarily identical, per the
    // idempotency key above) customer id isn't clobbered.
    const { data: claimed } = await supabase
      .from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("organization_id", profile.organization_id)
      .is("stripe_customer_id", null)
      .select("stripe_customer_id")
      .maybeSingle()

    if (!claimed) {
      // Someone else claimed it first (or the row didn't exist yet) --
      // re-read whatever is actually stored so we check out with the
      // customer id the DB agrees on.
      const { data: refreshed } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("organization_id", profile.organization_id)
        .maybeSingle()
      customerId = refreshed?.stripe_customer_id || customerId
    }
  }

  const isTrial = plan.interval === "month"

  // Create checkout session
  const sessionParams: any = {
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: appliedDiscount ? `DigiT ${plan.name} Plan (${appliedDiscount})` : `DigiT ${plan.name} Plan`,
            description: plan.description,
          },
          unit_amount: finalPriceCents,
          recurring: {
            interval: plan.interval,
          },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/pricing?canceled=true`,
    metadata: {
      plan_id: plan.id,
      organization_id: profile.organization_id,
      ...(appliedDiscount ? { discount_code: discountCode } : {}),
    },
    subscription_data: {
      metadata: {
        plan_id: plan.id,
        organization_id: profile.organization_id,
        ...(appliedDiscount ? { discount_code: discountCode } : {}),
      },
      ...(isTrial ? { trial_period_days: 7 } : {}),
    },
    ui_mode: "embedded",
  }

  // Request-scoped nonce: protects against Stripe's SDK-level automatic
  // retry (e.g. on a network blip) creating two sessions for one click,
  // without deduping deliberate repeat calls (a user retrying after
  // cancelling should get a fresh session).
  const idempotencyKey = `stripe-checkout-${profile.organization_id}-${plan.id}-${crypto.randomUUID()}`
  const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey })

  return { clientSecret: session.client_secret }
}

export async function createBillingPortalSession() {
  const stripe = await getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be logged in")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    throw new Error("No organization found")
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", profile.organization_id)
    .single()

  if (!subscription?.stripe_customer_id) {
    throw new Error("No billing account found")
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/settings`,
    })

    return { url: session.url }
  } catch (err: any) {
    if (err?.code === "resource_missing" || err?.raw?.code === "resource_missing") {
      // Stripe customer no longer exists (e.g. test/live mode mismatch) — clear the
      // stale reference so the UI falls back to the "Upgrade Plan" state.
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: null })
        .eq("organization_id", profile.organization_id)
      throw new Error("Your billing account could not be found. Please start a new subscription.")
    }
    throw err
  }
}
