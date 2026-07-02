import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import 'server-only'
import {
  trackTrialStarted,
  trackTrialEnded,
  trackFirstPayment,
  trackRefundRequested,
  trackRefundProcessed,
  trackSubscriptionCancelled,
} from "@/lib/analytics/billing-events"
import { getPlanById } from "@/lib/products"

import type { SubscriptionRecord } from "./types"

const TRIAL_DAYS = 7
const REFUND_WINDOW_DAYS = 30
const YEARLY_MIN_MONTHS = 3
const YEARLY_REMINDER_MONTH = 4

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
    const { stripe } = await import("@/lib/stripe")
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
    const { stripe } = await import("@/lib/stripe")
    try {
      await stripe.subscriptions.cancel(subRecord.stripe_subscription_id)

      const invoices = await stripe.invoices.list({
        subscription: subRecord.stripe_subscription_id,
        limit: 1,
      })

      if (invoices.data.length > 0) {
        const latestInvoice = invoices.data[0]
        if (latestInvoice.payment_intent && typeof latestInvoice.payment_intent === "string") {
          await stripe.refunds.create({
            payment_intent: latestInvoice.payment_intent,
          })
        }
      }
    } catch (err) {
      console.error("[v0] Failed to process Stripe refund:", err)
      return { success: false, error: "Failed to process Stripe refund" }
    }
  }

  if (subRecord.razorpay_subscription_id) {
    const razorpay = await import("./razorpay")
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
    const { stripe } = await import("@/lib/stripe")
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

function getMonthsSinceStart(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
}
