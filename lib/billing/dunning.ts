import { createServiceClient } from "@/lib/supabase/service"

export interface DunningAttempt {
  id: string
  subscriptionId: string
  organizationId: string
  attemptNumber: number
  amount: number
  currency: string
  status: "pending" | "success" | "failed"
  errorMessage?: string
  attemptedAt: string
  nextAttemptAt?: string
}

export interface DunningConfiguration {
  maxAttempts: number
  attemptIntervalHours: number[]
  webhookUrl?: string
  emailNotification: boolean
}

const DEFAULT_CONFIG: DunningConfiguration = {
  maxAttempts: 4,
  attemptIntervalHours: [0, 24, 72, 168],
  emailNotification: true,
}

export function getDunningConfig(): DunningConfiguration {
  return {
    maxAttempts: parseInt(process.env.DUNNING_MAX_ATTEMPTS || "4"),
    attemptIntervalHours: (process.env.DUNNING_INTERVAL_HOURS || "0,24,72,168")
      .split(",")
      .map(Number),
    webhookUrl: process.env.DUNNING_WEBHOOK_URL,
    emailNotification: process.env.DUNNING_EMAIL_NOTIFICATION !== "false",
  }
}

export async function recordFailedPayment(
  subscriptionId: string,
  organizationId: string,
  amount: number,
  currency: string,
  errorMessage?: string
): Promise<DunningAttempt | null> {
  const supabase = await createServiceClient()
  const config = getDunningConfig()

  const { data: previousAttempts } = await supabase
    .from("dunning_attempts")
    .select("attempt_number")
    .eq("subscription_id", subscriptionId)
    .order("attempt_number", { ascending: false })
    .limit(1)

  const attemptNumber = (previousAttempts?.[0]?.attempt_number || 0) + 1
  const intervalIndex = Math.min(attemptNumber - 1, config.attemptIntervalHours.length - 1)
  const hoursUntilNext = config.attemptIntervalHours[intervalIndex]
  
  let nextAttemptAt: string | undefined
  if (attemptNumber < config.maxAttempts && hoursUntilNext > 0) {
    nextAttemptAt = new Date(Date.now() + hoursUntilNext * 60 * 60 * 1000).toISOString()
  }

  const { data: attempt, error } = await supabase
    .from("dunning_attempts")
    .insert({
      subscription_id: subscriptionId,
      organization_id: organizationId,
      attempt_number: attemptNumber,
      amount,
      currency,
      status: "failed",
      error_message: errorMessage,
      attempted_at: new Date().toISOString(),
      next_attempt_at: nextAttemptAt,
    })
    .select("*")
    .single()

  if (error) return null

  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId)

  return {
    id: attempt.id,
    subscriptionId: attempt.subscription_id,
    organizationId: attempt.organization_id,
    attemptNumber: attempt.attempt_number,
    amount: attempt.amount,
    currency: attempt.currency,
    status: attempt.status,
    errorMessage: attempt.error_message,
    attemptedAt: attempt.attempted_at,
    nextAttemptAt: attempt.next_attempt_at,
  }
}

export async function retryDunning(
  subscriptionId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, razorpay_subscription_id, plan_id, billing_interval")
    .eq("id", subscriptionId)
    .single()

  if (!sub) return { success: false, error: "Subscription not found" }

  if (sub.stripe_subscription_id) {
    try {
      const { stripe } = await import("./stripe")
      const invoice = await stripe.invoices.create({
        customer: (await stripe.subscriptions.retrieve(sub.stripe_subscription_id)).customer as string,
        subscription: sub.stripe_subscription_id,
        auto_advance: true,
      })
      await stripe.invoices.pay(invoice.id)
      
      await recordSuccessfulPayment(subscriptionId, organizationId)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      await recordFailedPayment(subscriptionId, organizationId, 0, "USD", message)
      return { success: false, error: message }
    }
  }

  if (sub.razorpay_subscription_id) {
    try {
      const razorpay = await import("./razorpay")
      await razorpay.retryRazorpayPayment(subscriptionId)
      
      await recordSuccessfulPayment(subscriptionId, organizationId)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      await recordFailedPayment(subscriptionId, organizationId, 0, "INR", message)
      return { success: false, error: message }
    }
  }

  return { success: false, error: "No payment provider configured" }
}

export async function recordSuccessfulPayment(
  subscriptionId: string,
  organizationId: string
): Promise<void> {
  const supabase = await createServiceClient()
  
  await supabase
    .from("subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", subscriptionId)

  await supabase
    .from("dunning_attempts")
    .update({ status: "success" })
    .eq("subscription_id", subscriptionId)
    .eq("status", "failed")
}

export async function getDunningStatus(
  organizationId: string
): Promise<{
  isPastDue: boolean
  attempts: DunningAttempt[]
  nextAttemptAt?: string
  attemptsRemaining: number
}> {
  const supabase = await createServiceClient()
  const config = getDunningConfig()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("organization_id", organizationId)
    .single()

  if (!sub || sub.status !== "past_due") {
    return { isPastDue: false, attempts: [], attemptsRemaining: config.maxAttempts }
  }

  const { data: attempts } = await supabase
    .from("dunning_attempts")
    .select("*")
    .eq("subscription_id", sub.id)
    .order("attempt_number", { ascending: false })

  const attemptList = ((attempts as Record<string, unknown>[]) || []).map((a) => ({
    id: a.id as string,
    subscriptionId: a.subscription_id as string,
    organizationId: a.organization_id as string,
    attemptNumber: a.attempt_number as number,
    amount: a.amount as number,
    currency: a.currency as string,
    status: a.status as DunningAttempt["status"],
    errorMessage: a.error_message as string | undefined,
    attemptedAt: a.attempted_at as string,
    nextAttemptAt: a.next_attempt_at as string | undefined,
  }))

  const latestAttempt = attemptList[0]
  const attemptsRemaining = config.maxAttempts - (latestAttempt?.attemptNumber || 0)

  return {
    isPastDue: true,
    attempts: attemptList,
    nextAttemptAt: latestAttempt?.nextAttemptAt,
    attemptsRemaining: Math.max(0, attemptsRemaining),
  }
}
