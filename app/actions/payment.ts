"use server"

import { stripe } from "@/lib/stripe"
import { getPlanById } from "@/lib/products"
import { createClient } from "@/lib/supabase/server"

export async function createPaymentIntent(planId: string) {
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

  // Get user's profile and organization
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

  // Create a PaymentIntent for the subscription setup
  const paymentIntent = await stripe.paymentIntents.create({
    amount: plan.priceInCents,
    currency: "usd",
    customer: customerId,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      plan_id: plan.id,
      organization_id: profile.organization_id,
      type: "subscription_setup",
    },
    description: `DigiT ${plan.name} Plan - Monthly Subscription`,
    receipt_email: user.email || undefined,
  })

  return { 
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    customerId,
  }
}

export async function confirmSubscription(paymentIntentId: string, planId: string) {
  const plan = getPlanById(planId)
  if (!plan) {
    throw new Error("Invalid plan")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    throw new Error("No organization found")
  }

  // Retrieve the payment intent to verify it succeeded
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  
  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment not completed")
  }

  const customerId = paymentIntent.customer as string

  // Create a recurring price for this plan (product created inline)
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: plan.priceInCents,
    recurring: {
      interval: plan.interval,
    },
    product_data: {
      name: `DigiT ${plan.name} Plan`,
    },
  })

  // Create the actual subscription in Stripe
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    default_payment_method: paymentIntent.payment_method as string,
    metadata: {
      plan_id: plan.id,
      organization_id: profile.organization_id,
    },
  })

  const subscriptionItem = subscription.items.data[0]

  // Update the subscription in our database
  await supabase
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      plan_id: plan.id,
      status: "active",
      current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
    })
    .eq("organization_id", profile.organization_id)

  return { success: true, subscriptionId: subscription.id }
}

export async function getPaymentMethods() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { paymentMethods: [] }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return { paymentMethods: [] }
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", profile.organization_id)
    .single()

  if (!subscription?.stripe_customer_id) {
    return { paymentMethods: [] }
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: subscription.stripe_customer_id,
    type: "card",
  })

  return {
    paymentMethods: paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    })),
  }
}
