import { stripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { headers } from "next/headers"

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

  let event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  const supabase = await createClient()

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      const organizationId = session.metadata?.organization_id
      const planId = session.metadata?.plan_id

      if (organizationId && planId) {
        await supabase
          .from("subscriptions")
          .update({
            stripe_subscription_id: session.subscription as string,
            plan_id: planId,
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          })
          .eq("organization_id", organizationId)
      }
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object
      const organizationId = subscription.metadata?.organization_id

      if (organizationId) {
        const subscriptionItem = subscription.items.data[0]
        await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: new Date(
              subscriptionItem.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              subscriptionItem.current_period_end * 1000
            ).toISOString(),
          })
          .eq("organization_id", organizationId)
      }
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object
      const organizationId = subscription.metadata?.organization_id

      if (organizationId) {
        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("organization_id", organizationId)
      }
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object
      const customerId = invoice.customer as string

      const { data } = await supabase
        .from("subscriptions")
        .select("organization_id")
        .eq("stripe_customer_id", customerId)
        .single()

      if (data?.organization_id) {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("organization_id", data.organization_id)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
