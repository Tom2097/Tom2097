import { NextResponse } from "next/server"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { createServiceClient } from "@/lib/supabase/service"
import { syncStripePayouts, syncRazorpaySettlements } from "@/lib/billing/payout-sync"
import { logger } from "@/lib/logging"

/**
 * GET /api/platform/payouts
 *
 * Founder-only. Returns the money-flow funnel (subscriptions -> gateway
 * transactions -> verified payments -> payouts by status) plus the recent
 * payout list. Gated by platform-owner email, matching this console's own
 * layout gate (/api/platform/owner-check), not tenant RBAC.
 */
export async function GET() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) {
    return NextResponse.json(
      { error: "Forbidden", message: "Platform owner access required" },
      { status: 403 }
    )
  }

  try {
    const data = await buildPayoutSnapshot()
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    logger.logError("[v0] payouts snapshot error:", { error })
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to build payouts snapshot" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/platform/payouts
 *
 * Founder-only. Backfills real payout/settlement history directly from
 * Stripe's and Razorpay's own APIs -- this app cannot trigger or speed up a
 * payout, only observe one. Each gateway is synced independently so a
 * missing/misconfigured key for one doesn't block the other.
 */
export async function POST() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) {
    return NextResponse.json(
      { error: "Forbidden", message: "Platform owner access required" },
      { status: 403 }
    )
  }

  const errors: string[] = []
  let stripeSynced = 0
  let razorpaySynced = 0

  try {
    stripeSynced = await syncStripePayouts()
  } catch (error) {
    logger.logError("[v0] Stripe payout sync failed:", { error })
    errors.push("stripe")
  }

  try {
    razorpaySynced = await syncRazorpaySettlements()
  } catch (error) {
    logger.logError("[v0] Razorpay settlement sync failed:", { error })
    errors.push("razorpay")
  }

  const data = await buildPayoutSnapshot()
  return NextResponse.json({ ...data, synced: { stripe: stripeSynced, razorpay: razorpaySynced }, errors })
}

async function buildPayoutSnapshot() {
  const supabase = createServiceClient()

  const [subscriptionsResult, transactionsResult, verifiedResult, payoutsResult] = await Promise.all([
    supabase.from("subscriptions").select("id", { count: "exact", head: true }),
    supabase
      .from("billing_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["payment.completed", "payment.failed"]),
    supabase
      .from("billing_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(50),
  ])

  if (payoutsResult.error) throw payoutsResult.error

  const payouts = payoutsResult.data || []
  const statusTotals = {
    pending: { count: 0, amount: 0 },
    scheduled: { count: 0, amount: 0 },
    completed: { count: 0, amount: 0 },
    failed: { count: 0, amount: 0 },
  }
  for (const payout of payouts) {
    const bucket = statusTotals[payout.status as keyof typeof statusTotals]
    if (bucket) {
      bucket.count += 1
      bucket.amount += Number(payout.amount)
    }
  }

  return {
    funnel: {
      subscriptionsPurchased: subscriptionsResult.count || 0,
      transactionsCreated: transactionsResult.count || 0,
      paymentsVerified: verifiedResult.count || 0,
      settlements: statusTotals.completed.count + statusTotals.scheduled.count,
      payouts: payouts.length,
      bankAccount: statusTotals.completed.count,
    },
    statusTotals,
    payouts,
  }
}
