import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { handleStripeWebhook } from "@/lib/billing/stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

export async function POST(req: NextRequest) {
  // Initialize Stripe inside the handler to avoid build-time evaluation
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {})

  try {
    const body = await req.text()
    const signature = req.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("[v0] Stripe signature verification failed:", err)
      return NextResponse.json({ error: "Signature verification failed" }, { status: 403 })
    }

    // Process the webhook event
    await handleStripeWebhook(event)

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[v0] Stripe webhook processing failed:", err)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
