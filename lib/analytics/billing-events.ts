import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"

interface BillingAnalyticsEvent {
  eventType: "trial_started" | "trial_ended" | "first_payment" | "refund_requested" | "refund_processed" | "subscription_cancelled"
  organizationId: string
  userId: string
  planId: string
  metadata?: Record<string, unknown>
}

export async function trackBillingEvent(event: BillingAnalyticsEvent): Promise<void> {
  const supabase = await createServiceClient()

  // Record in analytics table
  await supabase.from("billing_analytics").insert({
    event_type: event.eventType,
    organization_id: event.organizationId,
    user_id: event.userId,
    plan_id: event.planId,
    metadata: event.metadata || {},
  })

  // Record in audit log
  await logAuthEvent({
    action: `billing.${event.eventType}` as string, // Type assertion for audit action
    organizationId: event.organizationId,
    userId: event.userId,
    resourceType: "subscription",
    resourceId: event.planId,
    metadata: event.metadata,
  })
}

// Helper functions for common events
export async function trackTrialStarted(
  organizationId: string,
  userId: string,
  planId: string,
  trialDays: number = 7,
): Promise<void> {
  await trackBillingEvent({
    eventType: "trial_started",
    organizationId,
    userId,
    planId,
    metadata: { trial_days: trialDays, trial_ends_at: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString() },
  })
}

export async function trackTrialEnded(
  organizationId: string,
  userId: string,
  planId: string,
): Promise<void> {
  await trackBillingEvent({
    eventType: "trial_ended",
    organizationId,
    userId,
    planId,
  })
}

export async function trackFirstPayment(
  organizationId: string,
  userId: string,
  planId: string,
  amount: number,
  currency: string,
): Promise<void> {
  await trackBillingEvent({
    eventType: "first_payment",
    organizationId,
    userId,
    planId,
    metadata: { amount, currency },
  })
}

export async function trackRefundRequested(
  organizationId: string,
  userId: string,
  planId: string,
  reason?: string,
): Promise<void> {
  await trackBillingEvent({
    eventType: "refund_requested",
    organizationId,
    userId,
    planId,
    metadata: { reason },
  })
}

export async function trackRefundProcessed(
  organizationId: string,
  userId: string,
  planId: string,
  amount: number,
  currency: string,
): Promise<void> {
  await trackBillingEvent({
    eventType: "refund_processed",
    organizationId,
    userId,
    planId,
    metadata: { amount, currency },
  })
}

export async function trackSubscriptionCancelled(
  organizationId: string,
  userId: string,
  planId: string,
  reason?: string,
): Promise<void> {
  await trackBillingEvent({
    eventType: "subscription_cancelled",
    organizationId,
    userId,
    planId,
    metadata: { reason },
  })
}