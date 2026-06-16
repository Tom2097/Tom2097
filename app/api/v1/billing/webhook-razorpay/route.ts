import { NextRequest, NextResponse } from "next/server"
import { handleRazorpayWebhook, verifyRazorpaySignature } from "@/lib/billing/razorpay"

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get("x-razorpay-signature")

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || ""

    // Verify Razorpay signature
    if (!verifyRazorpaySignature(body, signature, webhookSecret)) {
      console.error("[v0] Razorpay signature verification failed")
      return NextResponse.json({ error: "Signature verification failed" }, { status: 403 })
    }

    // Parse and process the webhook event. The delivery id (x-razorpay-event-id)
    // is the idempotency key used to dedupe duplicate deliveries.
    const payload = JSON.parse(body)
    const eventId = req.headers.get("x-razorpay-event-id")
    await handleRazorpayWebhook(payload, eventId)

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[v0] Razorpay webhook processing failed:", err)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
