import { createServiceClient } from "@/lib/supabase/service"
import { getPlanById } from "@/lib/products"

export interface ProrationResult {
  creditInCents: number
  chargeInCents: number
  netInCents: number
  daysRemaining: number
  daysInPeriod: number
  description: string
}

export async function calculateProration(
  organizationId: string,
  newPlanId: string
): Promise<ProrationResult | { error: string }> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single()

  if (!sub) return { error: "No active subscription" }

  const currentPlan = getPlanById(sub.plan_id)
  const newPlan = getPlanById(newPlanId)

  if (!currentPlan || !newPlan) return { error: "Plan not found" }

  const now = new Date()
  const periodEnd = new Date(sub.current_period_end)
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const daysInPeriod = 30

  if (daysRemaining === 0) {
    return {
      creditInCents: 0,
      chargeInCents: newPlan.priceInCents,
      netInCents: newPlan.priceInCents,
      daysRemaining: 0,
      daysInPeriod,
      description: `Full price for ${newPlan.name} plan`,
    }
  }

  const dailyCurrentRate = currentPlan.priceInCents / daysInPeriod
  const dailyNewRate = newPlan.priceInCents / daysInPeriod
  const creditInCents = Math.round(dailyCurrentRate * daysRemaining)
  const chargeForRemaining = Math.round(dailyNewRate * daysRemaining)
  const netInCents = chargeForRemaining - creditInCents

  const direction = netInCents >= 0 ? "additional charge" : "credit"

  return {
    creditInCents,
    chargeInCents: chargeForRemaining,
    netInCents,
    daysRemaining,
    daysInPeriod,
    description: `Switch from ${currentPlan.name} to ${newPlan.name}: ${direction} of ${formatCents(Math.abs(netInCents))} for ${daysRemaining} remaining days`,
  }
}

export async function executePlanChange(
  organizationId: string,
  newPlanId: string
): Promise<{ success: boolean; proration?: ProrationResult; error?: string }> {
  const proration = await calculateProration(organizationId, newPlanId)
  if ("error" in proration) return { success: false, error: proration.error }

  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single()

  if (!sub) return { success: false, error: "No subscription found" }

  if (sub.stripe_subscription_id) {
    try {
      const { stripe } = await import("./stripe")
      const newPlan = getPlanById(newPlanId)
      if (!newPlan) return { success: false, error: "New plan not found" }

      const stripePriceId = process.env[`STRIPE_PRICE_${newPlanId.toUpperCase()}`]
      if (!stripePriceId) {
        // Previously this silently skipped the Stripe update and fell
        // through to unconditionally writing plan_id below -- the org would
        // end up "on" a plan locally that Stripe never actually switched
        // them to (wrong price billed, wrong entitlements enforced
        // server-side vs. what Stripe shows the customer). Fail loudly
        // instead so plan_id never updates without Stripe confirming it.
        return { success: false, error: `Stripe price not configured for plan "${newPlanId}"` }
      }

      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ price: stripePriceId }],
        proration_behavior: "always_invoice",
      })
    } catch (err) {
      return { success: false, error: `Stripe error: ${err instanceof Error ? err.message : "Unknown"}` }
    }
  } else if (sub.razorpay_subscription_id) {
    try {
      const { updateRazorpaySubscription } = await import("./razorpay")
      const newPlan = getPlanById(newPlanId)
      if (!newPlan) return { success: false, error: "New plan not found" }

      // updateRazorpaySubscription() is the real Razorpay side-effect (PUT to
      // Razorpay's subscription endpoint). Previously this branch didn't
      // exist at all, so Razorpay/INR plan changes only ever updated our own
      // DB row and never told Razorpay -- the customer kept being billed on
      // their old plan. Only write plan_id below if this actually succeeds.
      const updated = await updateRazorpaySubscription(organizationId, {
        id: newPlan.id as "free" | "pro" | "enterprise",
        name: newPlan.name,
        price: newPlan.priceInr,
        currency: "INR",
        billingPeriod: newPlan.interval === "year" ? "yearly" : "monthly",
        features: newPlan.features,
      })

      if (!updated) {
        return { success: false, error: "Razorpay subscription update failed" }
      }
    } catch (err) {
      return { success: false, error: `Razorpay error: ${err instanceof Error ? err.message : "Unknown"}` }
    }
  }

  const now = new Date()
  const periodEnd = new Date(sub.current_period_end)

  await supabase
    .from("subscriptions")
    .update({
      plan_id: newPlanId,
      updated_at: now.toISOString(),
    })
    .eq("organization_id", organizationId)

  return { success: true, proration }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}
