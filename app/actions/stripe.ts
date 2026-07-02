"use server"

import { stripe } from "@/lib/stripe"
import { SUBSCRIPTION_PLANS, getPlanById } from "@/lib/products"
import { createClient } from "@/lib/supabase/server"

export async function createCheckoutSession(planId: string) {
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

  // Check for existing subscription
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", profile.organization_id)
    .single()

  let customerId = existingSub?.stripe_customer_id

  if (!customerId) {
    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        supabase_user_id: user.id,
        organization_id: profile.organization_id,
      },
    })
    customerId = customer.id

    // Update subscription with customer ID
    await supabase
      .from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("organization_id", profile.organization_id)
  }

  const isTrial = plan.interval === "month"

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `DigiT ${plan.name} Plan`,
            description: plan.description,
          },
          unit_amount: plan.priceInCents,
          recurring: {
            interval: plan.interval,
          },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?canceled=true`,
    metadata: {
      plan_id: plan.id,
      organization_id: profile.organization_id,
    },
    subscription_data: {
      metadata: {
        plan_id: plan.id,
        organization_id: profile.organization_id,
      },
      ...(isTrial ? { trial_period_days: 7 } : {}),
    },
    ui_mode: "embedded",
  })

  return { clientSecret: session.client_secret }
}

export async function createBillingPortalSession() {
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

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings`,
  })

  return { url: session.url }
}
