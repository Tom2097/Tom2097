import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
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
      apiVersion: "2023-10-16",
      typescript: true,
    })
  }
  
  return stripeInstance
}

// Export a `stripe` object with the required methods
export const stripe = {
  subscriptions: {
    retrieve: async (id: string) => (await getStripeInstance()).subscriptions.retrieve(id),
    update: async (id: string, params: Stripe.SubscriptionUpdateParams) => (await getStripeInstance()).subscriptions.update(id, params),
    cancel: async (id: string) => (await getStripeInstance()).subscriptions.cancel(id),
  },
  invoices: {
    create: async (params: Stripe.InvoiceCreateParams) => (await getStripeInstance()).invoices.create(params),
    list: async (params: Stripe.InvoiceListParams) => (await getStripeInstance()).invoices.list(params),
    pay: async (id: string, params?: Stripe.InvoicePayParams) => (await getStripeInstance()).invoices.pay(id, params),
  },
  refunds: {
    create: async (params: Stripe.RefundCreateParams) => (await getStripeInstance()).refunds.create(params),
  },
};

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

    // Create checkout session
    const planConfig = STRIPE_PLANS[plan.id]
    if (!planConfig) throw new Error(`Invalid plan: ${plan.id}`)

    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organization_id: organizationId, plan: plan.id },
    }

    if (isTrial) {
      sessionOptions.subscription_data = {
        trial_period_days: 7,
        metadata: { organization_id: organizationId, plan: plan.id },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionOptions)

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
