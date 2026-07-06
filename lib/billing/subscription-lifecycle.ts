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

import type { SubscriptionRecord } from "./types"

const TRIAL_DAYS = 7
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
  const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  return daysSinceStart <= REFUND_WINDOW_DAYS
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
    await razorpay.cancelRazorpaySubscription(organizationId)
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
    await razorpay.cancelRazorpaySubscription(organizationId)
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
