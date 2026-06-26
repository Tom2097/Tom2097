import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createStripeSession } from "@/lib/billing/stripe"
import { createRazorpaySession } from "@/lib/billing/razorpay"
import type { BillingPlan, CreateSessionInput } from "@/lib/billing/types"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const body = (await req.json()) as Partial<CreateSessionInput>

    const provider = (body.provider || "stripe") as "stripe" | "razorpay"
    const plan = body.plan || "pro"

    if (!["stripe", "razorpay"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
    }

    if (!["pro", "enterprise"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    // Construct URLs
    const baseUrl = req.headers.get("origin") || "http://localhost:3000"
    const successUrl = body.successUrl || `${baseUrl}/billing?status=success`
    const cancelUrl = body.cancelUrl || `${baseUrl}/billing?status=cancelled`

    // Create session based on provider
    let sessionUrl: string | null = null

    const basePlan: BillingPlan = { id: plan, name: plan, price: 0, currency: "USD", billingPeriod: "monthly", features: [] }
    if (provider === "stripe") {
      sessionUrl = await createStripeSession(organizationId, userId, basePlan, successUrl, cancelUrl)
    } else if (provider === "razorpay") {
      sessionUrl = await createRazorpaySession(organizationId, userId, { ...basePlan, currency: "INR" }, successUrl, cancelUrl)
    }

    if (!sessionUrl) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    return NextResponse.json({ sessionUrl, provider })
  } catch (err) {
    console.error("[v0] Billing session creation failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = handler
