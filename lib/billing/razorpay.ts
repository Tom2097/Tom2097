import axios from "axios"
import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import { claimWebhookEvent, completeWebhookEvent, failWebhookEvent } from "./idempotency"
import type { BillingPlan } from "./types"
import { logger } from "@/lib/logging"
import { razorpaySettlementStatus } from "./payout-status"
import { recordFailedPayment } from "./dunning"

const razorpayAuth = Buffer.from(
  `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
).toString("base64")

// Exported for lib/billing/payout-sync.ts's manual settlement backfill --
// same authenticated client, no need for a second axios instance.
export const razorpayInstance = axios.create({
  baseURL: "https://api.razorpay.com/v1",
  headers: { Authorization: `Basic ${razorpayAuth}` },
})

// Razorpay plan configuration
// Keyed by the real plan ids from lib/products.ts (starter/professional/
// enterprise) -- this previously used a stale free/pro/enterprise naming
// scheme that didn't match any real plan id, so INR checkout for starter
// and professional plans always failed with "Invalid plan".
const RAZORPAY_PLANS: Record<string, { planId: string | undefined; name: string }> = {
  starter: {
    planId: process.env.RAZORPAY_STARTER_PLAN_ID,
    name: "Starter",
  },
  professional: {
    planId: process.env.RAZORPAY_PROFESSIONAL_PLAN_ID,
    name: "Professional",
  },
  enterprise: {
    planId: process.env.RAZORPAY_ENTERPRISE_PLAN_ID,
    name: "Enterprise",
  },
}

// These placeholder ids used to be silently substituted whenever the real
// RAZORPAY_*_PLAN_ID env vars were unset, which meant a misconfigured
// deployment would happily send a fake plan id to Razorpay's API instead of
// failing loudly. Resolve the real plan id here and throw a clear
// configuration error instead.
const PLACEHOLDER_PLAN_IDS = new Set(["plan_1234567890", "plan_1234567891", "plan_0987654321"])

function resolveRazorpayPlanId(planKey: string): string {
  const config = RAZORPAY_PLANS[planKey]
  if (!config) throw new Error(`Invalid plan: ${planKey}`)
  if (!config.planId || PLACEHOLDER_PLAN_IDS.has(config.planId)) {
    throw new Error(`RAZORPAY_${planKey.toUpperCase()}_PLAN_ID is not configured`)
  }
  return config.planId
}

export async function createRazorpaySession(
  organizationId: string,
  userId: string,
  plan: BillingPlan,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  try {
    const supabase = await createServiceClient()

    // Get or create Razorpay customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("razorpay_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle()

    let customerId = sub?.razorpay_customer_id

    if (!customerId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, email")
        .eq("id", organizationId)
        .single()

      if (!org) throw new Error("Organization not found")

      const response = await razorpayInstance.post("/customers", {
        email: org.email,
        contact: org.name,
      })

      customerId = response.data.id
    }

    // Create subscription
    const razorpayPlanId = resolveRazorpayPlanId(plan.id)

    const response = await razorpayInstance.post("/subscriptions", {
      plan_id: razorpayPlanId,
      customer_notify: 1,
      customer_id: customerId,
      quantity: 1,
      total_count: 0, // Infinite
      metadata: {
        organization_id: organizationId,
        plan: plan.id,
      },
    })

    const subscriptionId = response.data.id
    const shortUrl = response.data.short_url

    // Log the session creation
    await logAuthEvent({
      action: "billing.session_created",
      userId,
      organizationId,
      resourceType: "billing_session",
      resourceId: subscriptionId,
      metadata: { plan: plan.id, provider: "razorpay" },
    })

    return shortUrl
  } catch (err) {
    console.error("[v0] Razorpay session creation failed:", err)
    return null
  }
}

export async function updateRazorpaySubscription(
  organizationId: string,
  newPlan: BillingPlan
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("razorpay_subscription_id")
      .eq("organization_id", organizationId)
      .single()

    if (!sub?.razorpay_subscription_id) return false

    const razorpayPlanId = resolveRazorpayPlanId(newPlan.id)

    await razorpayInstance.put(`/subscriptions/${sub.razorpay_subscription_id}`, {
      plan_id: razorpayPlanId,
      quantity: 1,
    })

    await logAuthEvent({
      action: "billing.subscription_updated",
      organizationId,
      resourceType: "subscription",
      resourceId: sub.razorpay_subscription_id,
      metadata: { plan: newPlan.id, provider: "razorpay" },
    })

    return true
  } catch (err) {
    console.error("[v0] Razorpay subscription update failed:", err)
    return false
  }
}

export async function retryRazorpayPayment(subscriptionId: string): Promise<void> {
  await razorpayInstance.post(`/subscriptions/${subscriptionId}/retry`, {})
}

export async function cancelRazorpaySubscription(organizationId: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient()

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("razorpay_subscription_id")
      .eq("organization_id", organizationId)
      .single()

    if (!sub?.razorpay_subscription_id) return false

    await razorpayInstance.post(`/subscriptions/${sub.razorpay_subscription_id}/cancel`, {})

    await logAuthEvent({
      action: "billing.subscription_cancelled",
      organizationId,
      resourceType: "subscription",
      resourceId: sub.razorpay_subscription_id,
      metadata: { provider: "razorpay" },
    })

    return true
  } catch (err) {
    console.error("[v0] Razorpay subscription cancellation failed:", err)
    return false
  }
}

export async function handleRazorpayWebhook(
  payload: Record<string, unknown>,
  eventId?: string | null,
): Promise<void> {
  // Idempotency: Razorpay's delivery id is supplied via the `x-razorpay-event-id`
  // header (passed in by the route). Duplicate deliveries are skipped.
  const firstTime = await claimWebhookEvent(
    "razorpay",
    eventId,
    typeof payload.event === "string" ? payload.event : undefined,
  )
  if (!firstTime) {
    logger.logInfo("[v0] Duplicate Razorpay webhook skipped:", { eventId })
    return
  }

  const supabase = await createServiceClient()

  try {
    const event = payload.event as string
    const inner = (payload.payload as Record<string, unknown>) || {}
    const subscription = (inner.subscription as { entity?: unknown })?.entity as Record<string, unknown> | undefined
    const payment = (inner.payment as { entity?: unknown })?.entity as Record<string, unknown> | undefined
    const settlement = (inner.settlement as { entity?: unknown })?.entity as Record<string, unknown> | undefined

    switch (event) {
      case "subscription.activated": {
        if (subscription) {
          const metadata = subscription.metadata as Record<string, string>
          const orgId = metadata?.organization_id

          if (orgId) {
            const { error: subscriptionError } = await supabase
              .from("subscriptions")
              .update({
                razorpay_subscription_id: subscription.id,
                razorpay_customer_id: subscription.customer_id,
                status: "active",
              })
              .eq("organization_id", orgId)
            if (subscriptionError) throw subscriptionError

            const { error: eventError } = await supabase.from("billing_events").insert({
              organization_id: orgId,
              event_type: "subscription.created",
              provider: "razorpay",
              external_id: subscription.id as string,
              status: "completed",
              metadata: { plan: metadata?.plan },
            })
            if (eventError) throw eventError
          }
        }
        break
      }

      case "payment.authorized": {
        if (payment) {
          const paymentMeta = payment.metadata as Record<string, string>
          const orgId = paymentMeta?.organization_id

          if (orgId && payment.amount) {
            const { error: eventError } = await supabase.from("billing_events").insert({
              organization_id: orgId,
              event_type: "payment.completed",
              provider: "razorpay",
              external_id: payment.id as string,
              amount: (payment.amount as number) / 100,
              status: "completed",
            })
            if (eventError) throw eventError
          }
        }
        break
      }

      case "payment.failed": {
        if (payment) {
          const paymentMeta = payment.metadata as Record<string, string>
          const orgId = paymentMeta?.organization_id

          if (orgId) {
            const { error: eventError } = await supabase.from("billing_events").insert({
              organization_id: orgId,
              event_type: "payment.failed",
              provider: "razorpay",
              external_id: payment.id as string,
              status: "failed",
              error_message: payment.error_description as string,
            })
            if (eventError) throw eventError

            // Same dunning wiring as the Stripe webhook's invoice.payment_failed
            // case -- sets status to "past_due" and schedules a retry via
            // lib/billing/dunning.ts instead of leaving the subscription's
            // status untouched (it was never updated here before).
            const { data: sub } = await supabase
              .from("subscriptions")
              .select("id")
              .eq("organization_id", orgId)
              .single()
            if (sub) {
              await recordFailedPayment(
                sub.id,
                orgId,
                typeof payment.amount === "number" ? payment.amount / 100 : 0,
                "inr",
                payment.error_description as string | undefined,
              )
            }
          }
        }
        break
      }

      case "subscription.cancelled": {
        if (subscription) {
          const metadata = subscription.metadata as Record<string, string>
          const orgId = metadata?.organization_id

          if (orgId) {
            const { error: subscriptionError } = await supabase
              .from("subscriptions")
              .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
              })
              .eq("organization_id", orgId)
            if (subscriptionError) throw subscriptionError

            const { error: eventError } = await supabase.from("billing_events").insert({
              organization_id: orgId,
              event_type: "subscription.cancelled",
              provider: "razorpay",
              external_id: subscription.id as string,
              status: "completed",
            })
            if (eventError) throw eventError
          }
        }
        break
      }

      // Settlements are platform-level (Razorpay's own payout to the
      // linked bank account), not scoped to an organization -- upsert by
      // (provider, external_id) same as Stripe payouts.
      case "settlement.processed": {
        if (settlement) {
          const { error: payoutError } = await supabase.from("payouts").upsert(
            {
              provider: "razorpay",
              external_id: settlement.id as string,
              amount: (settlement.amount as number) / 100,
              currency: "inr",
              status: razorpaySettlementStatus((settlement.status as string) || "processed"),
              arrival_date: new Date().toISOString(),
              metadata: { utr: settlement.utr, fees: (settlement.fees as number) / 100 },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "provider,external_id" }
          )
          if (payoutError) throw payoutError
        }
        break
      }
    }
    if (!eventId) throw new Error("Missing Razorpay webhook event ID")
    await completeWebhookEvent("razorpay", eventId)
  } catch (err) {
    if (eventId) await failWebhookEvent("razorpay", eventId, err)
    console.error("[v0] Failed to handle Razorpay webhook:", err)
    throw err
  }
}

export function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest()
  const supplied = Buffer.from(signature, "hex")

  // Buffers of different lengths would make timingSafeEqual throw; treat
  // that as "not a match" rather than leaking length info via an exception.
  if (supplied.length !== expected.length) {
    return false
  }

  return crypto.timingSafeEqual(supplied, expected)
}
