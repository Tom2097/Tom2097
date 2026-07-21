import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import 'server-only'
import type Stripe from "stripe"
import {
  trackTrialStarted,
  trackTrialEnded,
  trackFirstPayment,
  trackRefundRequested,
  trackRefundProcessed,
  trackSubscriptionCancelled,
} from "@/lib/analytics/billing-events"
import { getPlanById } from "@/lib/products"
import { calculateProration, executePlanChange } from "./proration"
import { recordFailedPayment, retryDunning, getDunningStatus } from "./dunning"
import { TRIAL_DAYS } from "./constants"

import type { SubscriptionRecord } from "./types"

export { TRIAL_DAYS }
const REFUND_WINDOW_DAYS = 30
const YEARLY_MIN_MONTHS = 3
const YEARLY_REMINDER_MONTH = 4

/**
 * Starts a 7-day free trial for the specified organization and plan
 * 
 * @param organizationId - The ID of the organization starting the trial
 * @param planId - The ID of the plan being trialed (e.g., "starter", "professional", "enterprise")
 * @param userId - The ID of the user initiating the trial
 * @returns Promise with success status
 * 
 * @description
 * This function:
 * 1. Creates or updates a subscription record with trial status
 * 2. Sets the trial end date to 7 days from now
 * 3. Records the trial start in billing analytics
 * 4. Logs the event for audit purposes
 */
export async function startTrial(
  organizationId: string,
  planId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const supabase = await createServiceClient()

  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from("subscriptions")
      .update({
        plan_id: planId,
        status: "trialing",
        trial_ends_at: trialEnd,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
        billing_interval: "month",
      })
      .eq("organization_id", organizationId)
  } else {
    await supabase.from("subscriptions").insert({
      organization_id: organizationId,
      user_id: userId,
      plan_id: planId,
      status: "trialing",
      trial_ends_at: trialEnd,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
      billing_interval: "month",
    })
  }

  await trackTrialStarted(organizationId, userId, planId, TRIAL_DAYS)

  return { success: true }
}

/**
 * Processes the end of a trial period and initiates the first payment
 * 
 * @param organizationId - The ID of the organization whose trial is ending
 * @returns Promise with charged status and optional error
 * 
 * @description
 * This function:
 * 1. Retrieves the subscription record
 * 2. Updates the subscription status from "trialing" to "active"
 * 3. Clears the trial end date
 * 4. Records the first payment in billing analytics
 * 5. Triggers the first charge via the payment provider
 */
export async function processTrialEnd(organizationId: string): Promise<{ charged: boolean; error?: string }> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id, status, stripe_subscription_id, razorpay_subscription_id")
    .eq("organization_id", organizationId)
    .single()

  if (!sub) return { charged: false, error: "No subscription found" }

  const subRecord = sub as { plan_id: string; user_id: string; id: string; status: string; stripe_subscription_id?: string; razorpay_subscription_id?: string }

  if (!sub) {
    return { charged: false, error: "No trial subscription found" }
  }

  if (sub.stripe_subscription_id) {
    const { stripe } = await import("@/lib/stripe.js")
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    if (subscription.status === "active" || subscription.status === "trialing") {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        trial_end: "now",
      })
    }
  }

  await trackTrialEnded(organizationId, sub.user_id, sub.plan_id)

  // Track first payment if this is the end of trial
  if (sub.status === "trialing") {
    const plan = await getPlanById(sub.plan_id)
    if (plan) {
      await trackFirstPayment(organizationId, sub.user_id, sub.plan_id, plan.priceInCents, "USD")
    }
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      trial_ends_at: null,
    })
    .eq("organization_id", organizationId)

  return { charged: true }
}

/**
 * Lazily expires a trial whose `trial_ends_at` has already passed.
 *
 * startTrial() writes a real `subscriptions` row with status "trialing", but
 * historically nothing ever transitioned it once the trial period elapsed --
 * processTrialEnd() (above) was only ever called from the test suite, and
 * that function isn't a fit for this job anyway: it unconditionally flips
 * status to "active" (i.e. paid) even when there's no stripe_subscription_id
 * or the charge never happened, which is exactly the "free forever" bug this
 * closes, not a fix for it. This transitions to "expired" instead -- an
 * already-defined SubscriptionRecord status (see lib/billing/types.ts) that
 * checkFeatureAccess()/getFeatureFlags() already treat as not-entitled
 * because they require status === "active".
 *
 * Idempotent: the update is guarded by `.eq("status", "trialing")`, so a
 * second call (from a concurrent request, or from the scheduled sweep below
 * after the lazy check already ran) is a no-op and never double-fires
 * trackTrialEnded().
 *
 * Reused by:
 * - lib/auth/server-auth.ts getAuthenticatedUser() -- per-request lazy check
 * - app/api/v1/billing/trials/run-due/route.ts -- scheduled batch sweep
 */
export async function expireTrialIfDue(organizationId: string): Promise<{ expired: boolean }> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, status, trial_ends_at, user_id, plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!sub || sub.status !== "trialing" || !sub.trial_ends_at) {
    return { expired: false }
  }

  if (new Date(sub.trial_ends_at).getTime() > Date.now()) {
    return { expired: false }
  }

  const { data: updated } = await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("status", "trialing")
    .select("id")

  if (!updated || updated.length === 0) {
    return { expired: false }
  }

  await trackTrialEnded(organizationId, sub.user_id, sub.plan_id)

  return { expired: true }
}

/**
 * Scheduled sweep: finds every subscription whose trial has run out but is
 * still sitting in "trialing" (i.e. no request from that org has hit the
 * lazy check in getAuthenticatedUser() since expiry) and expires it.
 * Delegates the actual transition to expireTrialIfDue() so both enforcement
 * paths share one idempotent code path.
 */
export async function expireAllDueTrials(): Promise<{ processed: number; expired: number }> {
  const supabase = await createServiceClient()

  const { data: dueSubs } = await supabase
    .from("subscriptions")
    .select("organization_id")
    .eq("status", "trialing")
    .lt("trial_ends_at", new Date().toISOString())

  const rows = dueSubs ?? []
  let expired = 0

  for (const row of rows) {
    const result = await expireTrialIfDue(row.organization_id)
    if (result.expired) expired++
  }

  return { processed: rows.length, expired }
}

/**
 * Checks if a subscription is within the 30-day refund window
 * 
 * @param organizationId - The ID of the organization to check
 * @returns Promise with boolean indicating if refund is available
 * 
 * @description
 * This function:
 * 1. Retrieves the subscription's current period start date
 * 2. Calculates days since first payment
 * 3. Returns true if within 30 days and plan is monthly
 * 4. Returns false for yearly plans (no refunds)
 */
export async function isWithinRefundWindow(organizationId: string): Promise<boolean> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("current_period_start, billing_interval")
    .eq("organization_id", organizationId)
    .single()

  if (!sub) return false
  if (sub.billing_interval === "year") return false

  const startDate = new Date(sub.current_period_start)
  if (Number.isNaN(startDate.getTime())) return false

  const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  return daysSinceStart >= 0 && daysSinceStart <= REFUND_WINDOW_DAYS
}

export async function processRefund(
  organizationId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const withinWindow = await isWithinRefundWindow(organizationId)
  if (!withinWindow) {
    return { success: false, error: "Refund window has expired" }
  }

  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single()

  if (!sub) return { success: false, error: "No subscription found" }

  const subRecord = sub as { plan_id: string; stripe_subscription_id?: string; razorpay_subscription_id?: string }

   if (subRecord.stripe_subscription_id) {
     const { stripe } = await import("./stripe")
     try {
      await stripe.subscriptions.cancel(subRecord.stripe_subscription_id)

      const invoices = await stripe.invoices.list({
        subscription: subRecord.stripe_subscription_id,
        limit: 1,
      })

      if (invoices.data.length > 0) {
        const latestInvoice = invoices.data[0]
        if (latestInvoice.payment_intent && typeof (latestInvoice as Stripe.Invoice).payment_intent === "string") {
          await stripe.refunds.create({
             payment_intent: (latestInvoice as Stripe.Invoice).payment_intent as string,
          })
        }
      }
    } catch (err) {
      console.error("[v0] Failed to process Stripe refund:", err)
      return { success: false, error: "Failed to process Stripe refund" }
    }
  }

  if (subRecord.razorpay_subscription_id) {
    const razorpay = await import("./razorpay.js")
    const cancelled = await razorpay.cancelRazorpaySubscription(organizationId)
    if (!cancelled) {
      // Don't report a refund as processed if Razorpay never actually
      // cancelled the subscription -- otherwise the customer keeps getting
      // billed while our DB (and the UI) says "refunded".
      return { success: false, error: "Failed to cancel Razorpay subscription" }
    }
  }

  const plan = await getPlanById(subRecord.plan_id)
  const amount = plan ? plan.priceInCents : 0

  await trackRefundProcessed(organizationId, userId, sub.plan_id, amount, "USD")

  await supabase
    .from("subscriptions")
    .update({ status: "refunded", cancelled_at: new Date().toISOString() })
    .eq("organization_id", organizationId)

  return { success: true }
}

export async function cancelSubscription(
  organizationId: string,
  userId: string,
): Promise<{
  charged: boolean;
  refunded?: boolean;
  error?: string
}> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single()

  if (!sub) return { charged: false, refunded: false, error: "No subscription found" }

  const withinRefund = await isWithinRefundWindow(organizationId)

  if (sub.billing_interval === "month") {
    if (withinRefund) {
      return await processRefundWithCancel(organizationId, userId, sub)
    }
    return await cancelAtPeriodEnd(organizationId, userId, sub)
  }

  const monthsSinceStart = getMonthsSinceStart(sub.current_period_start)
  if (monthsSinceStart < YEARLY_MIN_MONTHS) {
    return {
      charged: false,
      error: `Yearly plan requires a minimum ${YEARLY_MIN_MONTHS}-month commitment. You can cancel after month ${YEARLY_MIN_MONTHS}.`,
    }
  }

  return await cancelAtPeriodEnd(organizationId, userId, sub)
}

async function processRefundWithCancel(
  organizationId: string,
  userId: string,
  sub: SubscriptionRecord,
): Promise<{ charged: boolean; refunded: boolean; error?: string }> {
  const result = await processRefund(organizationId, userId)
  return { charged: result.success, refunded: result.success, error: result.error }
}

async function cancelAtPeriodEnd(
  organizationId: string,
  userId: string,
  sub: { plan_id: string; stripe_subscription_id?: string; razorpay_subscription_id?: string },
): Promise<{ charged: boolean; error?: string }> {
  const supabase = await createServiceClient()

  if (sub.stripe_subscription_id) {
    const { stripe } = await import("./stripe")
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })
  }

  if (sub.razorpay_subscription_id) {
    const razorpay = await import("./razorpay")
    const cancelled = await razorpay.cancelRazorpaySubscription(organizationId)
    if (!cancelled) {
      // Same reasoning as processRefund() above: if Razorpay rejects the
      // cancellation, the DB must not be marked cancelled -- otherwise the
      // customer sees "cancelled" while Razorpay keeps billing them.
      return { charged: false, error: "Failed to cancel Razorpay subscription" }
    }
  }

  await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)

  await trackSubscriptionCancelled(organizationId, userId, sub.plan_id, "user_requested")

  return { charged: true }
}

export async function getYearlyMilestone(organizationId: string): Promise<{
  monthsSinceStart: number
  reminderDue: boolean
  canCancel: boolean
}> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("current_period_start, billing_interval, status, cancelled_at, plan_id")
    .eq("organization_id", organizationId)
    .single()

  if (!sub) {
    return { monthsSinceStart: 0, reminderDue: false, canCancel: false }
  }

  const subRecord = sub as { current_period_start: string; billing_interval: string; status: string; cancelled_at?: string; plan_id: string }

  if (subRecord.billing_interval !== "year") {
    return { monthsSinceStart: 0, reminderDue: false, canCancel: false }
  }

  const monthsSinceStart = getMonthsSinceStart(sub.current_period_start)
  const reminderDue = monthsSinceStart >= YEARLY_REMINDER_MONTH && !sub.cancelled_at
  const canCancel = monthsSinceStart >= YEARLY_MIN_MONTHS

  return { monthsSinceStart, reminderDue, canCancel }
}

export async function acknowledgeYearlyReminder(organizationId: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase
    .from("subscriptions")
    .update({ cancel_at: null })
    .eq("organization_id", organizationId)
}

export { calculateProration, executePlanChange, recordFailedPayment, retryDunning, getDunningStatus }

export async function getDunningStatusForOrg(organizationId: string) {
  return getDunningStatus(organizationId)
}

export async function retryFailedPayment(organizationId: string) {
  const supabase = await createServiceClient()
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .single()
  if (!sub) return { success: false, error: "No subscription" }
  return retryDunning(sub.id, organizationId)
}

function getMonthsSinceStart(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
}
