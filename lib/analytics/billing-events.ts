import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, type AuthAuditAction } from "@/lib/auth/audit"

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
  const billingActions: Record<string, AuthAuditAction> = {
    "session_created": "billing.session_created",
    "subscription_created": "billing.subscription_created",
    "subscription_updated": "billing.subscription_updated",
    "subscription_cancelled": "billing.subscription_cancelled",
    "payment_completed": "billing.payment_completed",
    "payment_failed": "billing.payment_failed",
    "trial_started": "billing.trial_started",
    "refund_processed": "billing.refund_processed"
  }
  
  const action = billingActions[event.eventType] || "billing.subscription_updated"
  await logAuthEvent({
    action,
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