import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import { claimWebhookEvent } from "./idempotency"
import type { BillingPlan } from "./types"
import type Stripe from "stripe"

// Lazy load Stripe to avoid build-time evaluation
let stripeInstance: Stripe | null = null

async function getStripeInstance(): Promise<Stripe> {
  if (!stripeInstance) {
    const StripeModule = await import('stripe')
    const StripeClass = StripeModule.default || StripeModule
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
    }
    
    stripeInstance = new StripeClass(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
      typescript: true,
    })
  }
  
  return stripeInstance
}

// Stripe plan configuration
const STRIPE_PLANS: Record<string, { priceId: string; name: string }> = {
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    name: "Pro",
  },
  enterprise: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    name: "Enterprise",
  },
};

// Check if Stripe is fully configured
export const isStripeConfigured = () => {
  return !!(
    process.env.STRIPE_SECRET_KEY && 
    STRIPE_PLANS.pro.priceId && 
    STRIPE_PLANS.enterprise.priceId
  );
};

export async function createStripeSession(
  organizationId: string,
  userId: string,
  plan: BillingPlan,
  successUrl: string,
  cancelUrl: string,
  isTrial?: boolean
): Promise<string | null> {
  if (!isStripeConfigured()) {
    console.warn("[Stripe] Skipping session creation - Stripe is not configured");
    return null;
  }

  try {
    const supabase = await createServiceClient();
    const stripe = await getStripeInstance();

    // Get or create Stripe customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, trial_ends_at")
      .eq("organization_id", organizationId)
      .maybeSingle()

    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, email")
        .eq("id", organizationId)
        .single()

      if (!org) throw new Error("Organization not found")

      const customer = await stripe.customers.create({
        description: org.name,
        email: org.email || undefined,
        metadata: { organization_id: organizationId },
      })

      customerId = customer.id
    }

    // Check if trial is active
    const isTrialActive = sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date()
    if (isTrial && !isTrialActive) {
      // Update subscription to set trial end date
      await supabase
        .from("subscriptions")
        .update({
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "trialing"
        })
        .eq("organization_id", organizationId)
    }

    // Create checkout session
    const planConfig = STRIPE_PLANS[plan.id]
    if (!planConfig) throw new Error(`Invalid plan: ${plan.id}`)

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organization_id: organizationId, plan: plan.id },
      ...(isTrial && !isTrialActive ? { subscription_data: { trial_end: "now" } } : {}),
    })

    await logAuthEvent({
      action: "billing.session_created",
      userId,
      organizationId,
      resourceType: "billing_session",
      resourceId: session.id,
      metadata: { plan: plan.id, provider: "stripe" },
    })

    return session.url || null
  } catch (err) {
    console.error("[v0] Stripe session creation failed:", err)
    return null
  }
}

export async function updateStripeSubscription(
  organizationId: string,
  newPlan: BillingPlan
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    const stripe = await getStripeInstance()

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("organization_id", organizationId)
      .single()

    if (!sub?.stripe_subscription_id) return false

    const planConfig = STRIPE_PLANS[newPlan.id]
    if (!planConfig) throw new Error(`Invalid plan: ${newPlan.id}`)

    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    if (!subscription.items.data[0]) throw new Error("No subscription items found")

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: subscription.items.data[0].id, price: planConfig.priceId }],
    })

    await logAuthEvent({
      action: "billing.subscription_updated",
      organizationId,
      resourceType: "subscription",
      resourceId: sub.stripe_subscription_id,
      metadata: { plan: newPlan.id, provider: "stripe" },
    })

    return true
  } catch (err) {
    console.error("[v0] Stripe subscription update failed:", err)
    return false
  }
}

export async function cancelStripeSubscription(organizationId: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    const stripe = await getStripeInstance()

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("organization_id", organizationId)
      .single()

    if (!sub?.stripe_subscription_id) return false

    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true })

    await logAuthEvent({
      action: "billing.subscription_cancelled",
      organizationId,
      resourceType: "subscription",
      resourceId: sub.stripe_subscription_id,
      metadata: { provider: "stripe" },
    })

    return true
  } catch (err) {
    console.error("[v0] Stripe subscription cancellation failed:", err)
    return false
  }
}

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  const firstTime = await claimWebhookEvent("stripe", event.id, event.type)
  if (!firstTime) {
    console.log("[v0] Duplicate Stripe webhook skipped:", event.id)
    return
  }

  const supabase = await createServiceClient()
  const stripe = await getStripeInstance()

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = (subscription.metadata as Record<string, string>)?.organization_id

        if (orgId) {
          await supabase
            .from("subscriptions")
            .update({
              stripe_subscription_id: subscription.id,
              status: "active",
            })
            .eq("organization_id", orgId)

          await supabase.from("billing_events").insert({
            organization_id: orgId,
            event_type: "subscription.created",
            provider: "stripe",
            external_id: subscription.id,
            status: "completed",
            metadata: { plan: (subscription.metadata as Record<string, string>)?.plan },
          })
        }
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceSubscription = (invoice as { subscription?: unknown }).subscription
        if (typeof invoiceSubscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(invoiceSubscription as string)
          const orgId = (subscription.metadata as Record<string, string>)?.organization_id

          if (orgId && invoice.amount_paid) {
            const subRecord = await supabase
              .from("subscriptions")
              .select("id")
              .eq("stripe_subscription_id", subscription.id)
              .single()

            await supabase.from("billing_events").insert({
              organization_id: orgId,
              subscription_id: subRecord.data?.id,
              event_type: "payment.completed",
              provider: "stripe",
              external_id: invoice.id,
              amount: invoice.amount_paid / 100,
              status: "completed",
            })
          }
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceSubscription = (invoice as { subscription?: unknown }).subscription
        if (typeof invoiceSubscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(invoiceSubscription as string)
          const orgId = (subscription.metadata as Record<string, string>)?.organization_id

          if (orgId) {
            await supabase.from("billing_events").insert({
              organization_id: orgId,
              event_type: "payment.failed",
              provider: "stripe",
              external_id: invoice.id,
              status: "failed",
              error_message: invoice.last_finalization_error?.code || "Payment failed",
            })
          }
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = (subscription.metadata as Record<string, string>)?.organization_id

        if (orgId) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
            .eq("organization_id", orgId)

          await supabase.from("billing_events").insert({
            organization_id: orgId,
            event_type: "subscription.cancelled",
            provider: "stripe",
            external_id: subscription.id,
            status: "completed",
          })
        }
        break
      }
    }
  } catch (err) {
    console.error("[v0] Failed to handle Stripe webhook:", err)
    throw err
  }
}
