import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/service"
import { claimWebhookEvent, completeWebhookEvent, failWebhookEvent } from "@/lib/billing/idempotency"
import { recordDiscountUse } from "@/lib/billing/discounts"
import { getPlanIdFromStripePriceId } from "@/lib/products"
import { stripePayoutStatus } from "@/lib/billing/payout-status"
import { recordFailedPayment } from "@/lib/billing/dunning"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

// Stripe payouts are platform-level (from the account's own balance), not
// scoped to an organization -- upsert by (provider, external_id) so
// payout.created/updated/paid/failed can all land on the same row regardless
// of delivery order.
async function upsertStripePayout(supabase: SupabaseClient, payout: Stripe.Payout) {
  const { error } = await supabase.from("payouts").upsert(
    {
      provider: "stripe",
      external_id: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      status: stripePayoutStatus(payout.status),
      arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
      failure_message: payout.failure_message,
      metadata: { stripe_status: payout.status },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,external_id" }
  )
  if (error) throw error
}

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 })
  }

  const stripe = await getStripe()

  let event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  // Dedupe against the webhook_events ledger before doing any work -- Stripe
  // retries deliveries that don't get a fast 2xx, and without this guard a
  // retried checkout.session.completed would re-run the discount redemption
  // and subscription writes below a second time.
  const firstTime = await claimWebhookEvent("stripe", event.id, event.type)
  if (!firstTime) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Service-role client: this route has no user session to bind cookies to
  // (Stripe calls it server-to-server), and the subscriptions table's RLS
  // policy only grants SELECT, not UPDATE -- the trust boundary here is the
  // verified Stripe signature above, not a user session.
  const supabase = createServiceClient()

  try {
    switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      const organizationId = session.metadata?.organization_id
      const planId = session.metadata?.plan_id

      if (organizationId && planId) {
        const subscriptionId = session.subscription as string
        const stripeSub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null

        const isTrialing = stripeSub?.status === "trialing"
        const trialEnd = stripeSub?.trial_end
          ? new Date(stripeSub.trial_end * 1000).toISOString()
          : null

        // Use the real Stripe subscription's period + interval (same fields
        // the customer.subscription.updated handler below reads) instead of
        // assuming a 30-day monthly period -- annual/other-interval plans
        // were getting a period_end 11+ months too early.
        const periodStart = stripeSub?.current_period_start
          ? new Date(stripeSub.current_period_start * 1000).toISOString()
          : new Date().toISOString()
        const periodEnd = stripeSub?.current_period_end
          ? new Date(stripeSub.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const billingInterval = stripeSub?.items.data[0]?.price?.recurring?.interval || "month"

        const { error: subscriptionUpdateError } = await supabase
          .from("subscriptions")
          .update({
            stripe_subscription_id: subscriptionId,
            plan_id: planId,
            status: isTrialing ? "trialing" : "active",
            trial_ends_at: trialEnd,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            billing_interval: billingInterval,
          })
          .eq("organization_id", organizationId)
        if (subscriptionUpdateError) throw subscriptionUpdateError

        // Claim the discount redemption now that payment is confirmed --
        // NOT at checkout creation, so an abandoned checkout never burns a
        // use (see lib/billing/discounts.ts).
        const discountCode = session.metadata?.discount_code
        if (discountCode) {
          const { claimed, discount } = await recordDiscountUse(discountCode, organizationId, session.id)
          if (claimed && discount) {
            const { error: billingEventError } = await supabase.from("billing_events").insert({
              organization_id: organizationId,
              event_type: "discount_applied",
              provider: "stripe",
              metadata: { code: discount.code, value: discount.value, plan_id: planId },
            })
            if (billingEventError) throw billingEventError
          }
        }
      }
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object
      const organizationId = subscription.metadata?.organization_id

      if (organizationId) {
        // A billing-portal-driven plan change lands here with no
        // checkout.session.completed event at all -- derive plan_id from the
        // subscription's current price so plan_id doesn't silently desync
        // from what Stripe (and the customer) actually has.
        const priceId = subscription.items.data[0]?.price?.id
        const planId = getPlanIdFromStripePriceId(priceId)

        const { error: subscriptionUpdateError } = await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: new Date(
              subscription.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            ...(planId ? { plan_id: planId } : {}),
          })
          .eq("organization_id", organizationId)
        if (subscriptionUpdateError) throw subscriptionUpdateError
      }
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object
      const organizationId = subscription.metadata?.organization_id

      if (organizationId) {
        const { error: subscriptionUpdateError } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("organization_id", organizationId)
        if (subscriptionUpdateError) throw subscriptionUpdateError
      }
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object
      const customerId = invoice.customer as string

      const { data, error: subscriptionReadError } = await supabase
        .from("subscriptions")
        .select("id, organization_id")
        .eq("stripe_customer_id", customerId)
        .single()
      if (subscriptionReadError) throw subscriptionReadError

      if (data?.organization_id) {
        // recordFailedPayment (lib/billing/dunning.ts) sets status to
        // "past_due" itself and logs a dunning_attempts row with a
        // scheduled next_attempt_at -- this replaces the bare status
        // update that used to happen here with no retry schedule at all.
        await recordFailedPayment(
          data.id,
          data.organization_id,
          invoice.amount_due / 100,
          "usd",
          invoice.last_finalization_error?.message,
        )

        const { error: billingEventError } = await supabase.from("billing_events").insert({
          organization_id: data.organization_id,
          event_type: "payment.failed",
          provider: "stripe",
          external_id: invoice.id,
          amount: invoice.amount_due / 100,
          status: "failed",
        })
        if (billingEventError) throw billingEventError
      }
      break
    }

    case "invoice.paid": {
      const invoice = event.data.object
      const customerId = invoice.customer as string

      const { data, error: subscriptionReadError } = await supabase
        .from("subscriptions")
        .select("organization_id")
        .eq("stripe_customer_id", customerId)
        .single()
      if (subscriptionReadError) throw subscriptionReadError

      if (data?.organization_id) {
        const { error: billingEventError } = await supabase.from("billing_events").insert({
          organization_id: data.organization_id,
          event_type: "payment.completed",
          provider: "stripe",
          external_id: invoice.id,
          amount: invoice.amount_paid / 100,
          status: "completed",
        })
        if (billingEventError) throw billingEventError
      }
      break
    }

    case "payout.created":
    case "payout.updated":
    case "payout.paid":
    case "payout.failed": {
      await upsertStripePayout(supabase, event.data.object)
      break
    }
    }
    await completeWebhookEvent("stripe", event.id)
  } catch (error) {
    await failWebhookEvent("stripe", event.id, error)
    throw error
  }

  return NextResponse.json({ received: true })
}
