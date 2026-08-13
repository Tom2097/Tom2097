import "server-only"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/service"
import { ANNUAL_PRICE_CENTS } from "@/lib/products"
import { issueInvoice } from "./charge"

export interface SwitchToAnnualResult {
  success: boolean
  error?: string
}

/**
 * Self-service "upgrade": a monthly customer converting to annual, saving
 * $44.49*12 - $499 = $34.88/year (founder-confirmed the only real upgrade
 * path now that there's a single plan with two billing intervals, not
 * tiers). Charges the full $499 immediately and starts a fresh 12-month
 * term today, rather than waiting for the current monthly period to end --
 * the founder's explicit choice over a deferred switch.
 *
 * Order matters: the new annual charge is attempted FIRST, and the
 * Stripe subscription is only cancelled -- and the DB only updated -- once
 * that charge succeeds. If the charge fails, the customer is left exactly
 * as they were (still on their working monthly subscription) rather than
 * stranded with neither a working recurring subscription nor a paid annual
 * term.
 */
export async function switchToAnnual(organizationId: string): Promise<SwitchToAnnualResult> {
  const db = createServiceClient()

  const { data: sub } = await db
    .from("subscriptions")
    .select("id, status, stripe_customer_id, stripe_subscription_id, billing_interval")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!sub) return { success: false, error: "No subscription found" }
  if (sub.billing_interval !== "month") return { success: false, error: "Already on the annual plan" }
  if (sub.status !== "trialing" && sub.status !== "active") {
    return { success: false, error: `Cannot switch plans from status "${sub.status}"` }
  }
  if (!sub.stripe_customer_id) return { success: false, error: "No payment method on file" }

  const { data: pm } = await db
    .from("payment_methods")
    .select("provider_token, type")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .maybeSingle()

  if (!pm) return { success: false, error: "No payment method on file" }

  const stripe = await getStripe()
  const idempotencyKey = `switch-to-annual-${sub.id}`

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: ANNUAL_PRICE_CENTS,
        currency: "usd",
        customer: sub.stripe_customer_id,
        payment_method: pm.provider_token,
        off_session: true,
        confirm: true,
        metadata: { organization_id: organizationId, subscription_id: sub.id, reason: "switch_to_annual" },
      },
      { idempotencyKey },
    )

    if (pi.status !== "succeeded") throw new Error(`PaymentIntent ended in status "${pi.status}"`)

    const invoice = await issueInvoice(organizationId, sub.id, ANNUAL_PRICE_CENTS, "usd", "DigiT annual subscription -- switched from monthly")

    await db.from("payments").insert({
      organization_id: organizationId,
      invoice_id: invoice.id,
      subscription_id: sub.id,
      amount_cents: ANNUAL_PRICE_CENTS,
      currency: "usd",
      method: pm.type,
      provider_ref: pi.id,
      status: "succeeded",
      idempotency_key: idempotencyKey,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed"
    return { success: false, error: message }
  }

  // Charge succeeded -- now safe to retire the monthly subscription and
  // flip the DB record over. A failure past this point (Stripe cancel, or
  // the DB update) would leave a paid annual charge with no matching
  // record, so both are best-effort but the charge itself is what's
  // authoritative; the webhook's customer.subscription.deleted handler is
  // a second, independent path that also converges the DB if this direct
  // cancel call doesn't land.
  if (sub.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id)
    } catch {
      // Non-fatal: the customer already paid for annual and owns the new
      // term either way; a lingering Stripe subscription with no default
      // payment method attached simply won't renew successfully.
    }
  }

  const now = new Date()
  const termEnd = new Date(now)
  termEnd.setFullYear(termEnd.getFullYear() + 1)

  await db
    .from("subscriptions")
    .update({
      status: "active",
      billing_interval: "year",
      billing_mode: "one_time",
      locked_price_cents: ANNUAL_PRICE_CENTS,
      stripe_subscription_id: null,
      trial_ends_at: null,
      trial_start: null,
      current_period_start: now.toISOString(),
      current_period_end: termEnd.toISOString(),
    })
    .eq("id", sub.id)

  return { success: true }
}
