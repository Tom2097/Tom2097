import { handleRazorpayWebhook, verifyRazorpaySignature } from "@/lib/billing/razorpay"
import { NextResponse } from "next/server"
import { headers } from "next/headers"

// Razorpay webhook receiver. lib/billing/razorpay.ts's handleRazorpayWebhook
// (signature-adjacent business logic: idempotency claim + subscription/
// payment event handling) was fully written but had no route wired up to
// receive Razorpay's webhook POSTs -- this was the missing piece.
//
// Signature verification follows Razorpay's documented webhook contract:
// the raw request body is HMAC-SHA256'd with the webhook secret (configured
// in the Razorpay dashboard, not the RAZORPAY_KEY_SECRET used for API auth)
// and compared against the `X-Razorpay-Signature` header.
export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("x-razorpay-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 })
  }

  if (!verifyRazorpaySignature(body, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  // Per lib/billing/razorpay.ts's handleRazorpayWebhook, Razorpay's delivery
  // id (used for idempotency dedup via claimWebhookEvent) is supplied via
  // this header.
  const eventId = headersList.get("x-razorpay-event-id")
  if (!eventId) {
    return NextResponse.json({ error: "Missing webhook event ID" }, { status: 400 })
  }

  try {
    await handleRazorpayWebhook(payload, eventId)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Webhook handler error: ${message}` }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
