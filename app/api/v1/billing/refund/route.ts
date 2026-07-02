import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { isWithinRefundWindow, processRefund } from "@/lib/billing/subscription-lifecycle"
import { trackRefundRequested } from "@/lib/analytics/billing-events"

const requestRefund = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const { reason } = await req.json()

    // Check if within refund window
    const withinWindow = await isWithinRefundWindow(organizationId)
    if (!withinWindow) {
      return NextResponse.json(
        { error: "Refund window has expired. Refunds are only available within 30 days of first payment." },
        { status: 400 }
      )
    }

    // Track refund request
    const supabase = await createServiceClient()
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id")
      .eq("organization_id", organizationId)
      .single()

    if (sub) {
      await trackRefundRequested(organizationId, userId, sub.plan_id, reason)
    }

    return NextResponse.json({ success: true, message: "Refund request received. Processing may take 3-5 business days." })
  } catch (err) {
    console.error("[v0] Refund request failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = requestRefund