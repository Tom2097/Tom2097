import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import { hasPermission } from "@/lib/auth/rbac"
import { updateStripeSubscription, cancelStripeSubscription } from "@/lib/billing/stripe"
import { updateRazorpaySubscription, cancelRazorpaySubscription } from "@/lib/billing/razorpay"

// GET /api/v1/billing/subscriptions - List subscriptions (requires billing:view)
const list = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const canView = await hasPermission(userId, "billing:view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    console.error("[v0] Failed to fetch subscriptions:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

// PATCH /api/v1/billing/subscriptions - Update subscription plan (requires billing:manage)
const update = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const canManage = await hasPermission(userId, "billing:manage")
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { plan, provider } = (await req.json()) as { plan?: string; provider?: string }

    if (!plan || !["pro", "enterprise"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .single()

    if (!subscription) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 })
    }

    const detectedProvider = provider || (subscription.stripe_subscription_id ? "stripe" : "razorpay")

    let success = false
    const billingPlan = {
      id: plan as "pro" | "enterprise",
      name: plan,
      price: 0,
      currency: detectedProvider === "razorpay" ? ("INR" as const) : ("USD" as const),
      billingPeriod: "monthly" as const,
      features: [] as string[],
    }

    if (detectedProvider === "stripe") {
      success = await updateStripeSubscription(organizationId, billingPlan)
    } else {
      success = await updateRazorpaySubscription(organizationId, billingPlan)
    }

    if (!success) {
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 })
    }

    await supabase
      .from("subscriptions")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)

    await logAuthEvent({
      action: "billing.subscription_updated",
      userId,
      organizationId,
      resourceType: "subscription",
      metadata: { plan, provider: detectedProvider },
    })

    return NextResponse.json({ success: true, plan })
  } catch (err) {
    console.error("[v0] Failed to update subscription:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

// DELETE /api/v1/billing/subscriptions - Cancel subscription (requires billing:manage)
const cancel = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const canManage = await hasPermission(userId, "billing:manage")
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = await createServiceClient()
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .single()

    if (!subscription) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 })
    }

    const provider = subscription.stripe_subscription_id ? "stripe" : "razorpay"
    const success =
      provider === "stripe"
        ? await cancelStripeSubscription(organizationId)
        : await cancelRazorpaySubscription(organizationId)

    if (!success) {
      return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 })
    }

    await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)

    await logAuthEvent({
      action: "billing.subscription_cancelled",
      userId,
      organizationId,
      resourceType: "subscription",
      metadata: { provider },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Failed to cancel subscription:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const GET = list
export const PATCH = update
export const DELETE = cancel
