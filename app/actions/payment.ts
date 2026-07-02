"use server"

import { stripe } from "@/lib/stripe"
import { getPlanById } from "@/lib/products"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

async function resolveCustomer(
  planId: string,
  user: { id: string; email?: string },
  profile: { organization_id: string },
): Promise<string> {
  const db = createServiceClient()

  const { data: existingSub } = await db
    .from("subscriptions")
    .select("id, stripe_customer_id")
    .eq("organization_id", profile.organization_id)
    .maybeSingle()

  let customerId = existingSub?.stripe_customer_id ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        supabase_user_id: user.id,
        organization_id: profile.organization_id,
      },
    })
    customerId = customer.id

    if (existingSub?.id) {
      await db
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("id", existingSub.id)
    } else {
      const { error: insertError } = await db.from("subscriptions").insert({
        organization_id: profile.organization_id,
        stripe_customer_id: customerId,
        plan_id: planId,
        status: "incomplete",
      })
      if (insertError && !insertError.message.includes("duplicate")) {
        throw new Error(`Failed to create subscription record: ${insertError.message}`)
      }
    }
  }

  return customerId
}

export async function createPaymentIntent(planId: string) {
  const plan = getPlanById(planId)
  if (!plan) {
    throw new Error("Invalid plan selected")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be logged in to subscribe")

  const db = createServiceClient()

  const { data: profile } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    throw new Error("No organization found for this account")
  }

  const customerId = await resolveCustomer(planId, user, profile)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: plan.priceInCents,
    currency: "usd",
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      plan_id: plan.id,
      organization_id: profile.organization_id,
      type: "subscription_setup",
    },
    description: `DigiT ${plan.name} Plan - Monthly Subscription`,
    receipt_email: user.email || undefined,
  })

  if (!paymentIntent.client_secret) {
    throw new Error("Payment session could not be created. Please try again.")
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    customerId,
  }
}

export async function setupTrialSubscription(planId: string) {
  const plan = getPlanById(planId)
  if (!plan) throw new Error("Invalid plan selected")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be logged in to subscribe")

  const db = createServiceClient()

  const { data: profile } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    throw new Error("No organization found for this account")
  }

  const customerId = await resolveCustomer(planId, user, profile)

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    metadata: {
      plan_id: plan.id,
      organization_id: profile.organization_id,
      type: "trial_setup",
    },
  })

  return {
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    customerId,
  }
}

export async function confirmTrialSubscription(setupIntentId: string, planId: string) {
  const plan = getPlanById(planId)
  if (!plan) throw new Error("Invalid plan")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const db = createServiceClient()

  const { data: profile } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) throw new Error("No organization found")

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
  if (setupIntent.status !== "succeeded") {
    throw new Error("Card setup not completed")
  }

  const customerId = setupIntent.customer as string
  const paymentMethod = setupIntent.payment_method as string

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: plan.priceInCents,
    recurring: { interval: plan.interval },
    product_data: { name: `DigiT ${plan.name} Plan` },
  })

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    default_payment_method: paymentMethod,
    trial_period_days: 7,
    metadata: {
      plan_id: plan.id,
      organization_id: profile.organization_id,
    },
  })

  const subscriptionItem = subscription.items.data[0]

  const { data: existingRow } = await db
    .from("subscriptions")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .maybeSingle()

  const subData = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    plan_id: plan.id,
    status: "trialing" as const,
    trial_ends_at: new Date((subscription.trial_end ?? 0) * 1000).toISOString(),
    current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
    billing_interval: plan.interval as "month" | "year",
  }

  if (existingRow) {
    await db.from("subscriptions").update(subData).eq("organization_id", profile.organization_id)
  } else {
    await db.from("subscriptions").insert({
      ...subData,
      organization_id: profile.organization_id,
    })
  }

  return { success: true, subscriptionId: subscription.id }
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

  const db = createServiceClient()

  const { data: profile } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    throw new Error("No organization found")
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  
  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment not completed")
  }

  const customerId = paymentIntent.customer as string

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

  // Update the subscription row - it should exist from createPaymentIntent or be created here
  const { data: existingRow, error: selectError } = await db
    .from("subscriptions")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .maybeSingle()

  if (selectError && !selectError.message.includes("no rows")) {
    console.error("[payment] Failed to check subscription row:", selectError)
    throw new Error(`Failed to check subscription: ${selectError.message}`)
  }

  if (existingRow) {
    // Row exists, update it
    const { error: updateError } = await db
      .from("subscriptions")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        plan_id: plan.id,
        status: "active",
        current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
      })
      .eq("organization_id", profile.organization_id)

    if (updateError) {
      console.error("[payment] Subscription update failed:", updateError)
      throw new Error(`Failed to save subscription: ${updateError.message}`)
    }
  } else {
    // Row doesn't exist, create it
    const { error: insertError } = await db
      .from("subscriptions")
      .insert({
        organization_id: profile.organization_id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        plan_id: plan.id,
        status: "active",
        current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
      })

    if (insertError) {
      console.error("[payment] Subscription insert failed:", insertError)
      throw new Error(`Failed to create subscription: ${insertError.message}`)
    }
  }

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
    paymentMethods: paymentMethods.data.map((pm: any) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    })),
  }
}
