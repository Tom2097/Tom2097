import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

const EXTRA_SEAT_PRICE_CENTS = 2900

export const POST = withAuth(async (req, { organizationId, userId }) => {
  const { quantity } = await req.json()

  if (!quantity || quantity < 1 || quantity > 100) {
    return NextResponse.json({ error: "Quantity must be between 1 and 100" }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status, stripe_customer_id")
    .eq("organization_id", organizationId)
    .single()

  if (!sub || sub.status !== "active") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 400 })
  }

  const totalCents = quantity * EXTRA_SEAT_PRICE_CENTS

  const { error } = await supabase.from("billing_events").insert({
    organization_id: organizationId,
    event_type: "extra_seats.added",
    provider: "internal",
    amount: totalCents / 100,
    status: "pending",
    metadata: { quantity, price_per_seat: EXTRA_SEAT_PRICE_CENTS / 100, user_id: userId },
  })

  if (error) {
    return NextResponse.json({ error: "Failed to process extra seats" }, { status: 500 })
  }

  const { error: usageError } = await supabase.from("usage_metering").insert({
    organization_id: organizationId,
    metric: "seats",
    value: quantity,
    metadata: { type: "extra_seats_purchase" },
  })

  if (usageError) {
    console.error("[v0] Failed to record seat usage:", usageError)
  }

  return NextResponse.json({
    success: true,
    quantity,
    total: totalCents / 100,
    pricePerSeat: EXTRA_SEAT_PRICE_CENTS / 100,
  })
})
