import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/service"
import { razorpayInstance } from "./razorpay"
import { stripePayoutStatus, razorpaySettlementStatus } from "./payout-status"

// On-demand backfill so the payouts page isn't empty until the next webhook
// fires -- pulls the gateways' own payout/settlement history directly,
// same upsert-by-(provider,external_id) the webhooks use, so a manual sync
// and a webhook delivery for the same payout never create duplicate rows.

export async function syncStripePayouts(): Promise<number> {
  const stripe = await getStripe()
  const supabase = createServiceClient()

  const payouts = await stripe.payouts.list({ limit: 20 })
  let synced = 0
  for (const payout of payouts.data) {
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
    if (!error) synced++
  }
  return synced
}

interface RazorpaySettlement {
  id: string
  amount: number
  status: string
  utr?: string
  fees?: number
  created_at: number
}

export async function syncRazorpaySettlements(): Promise<number> {
  const supabase = createServiceClient()

  const response = await razorpayInstance.get<{ items: RazorpaySettlement[] }>(
    "/settlements",
    { params: { count: 20 } }
  )
  let synced = 0
  for (const settlement of response.data.items) {
    const { error } = await supabase.from("payouts").upsert(
      {
        provider: "razorpay",
        external_id: settlement.id,
        amount: settlement.amount / 100,
        currency: "inr",
        status: razorpaySettlementStatus(settlement.status),
        arrival_date: new Date(settlement.created_at * 1000).toISOString(),
        metadata: { utr: settlement.utr, fees: settlement.fees ? settlement.fees / 100 : null },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,external_id" }
    )
    if (!error) synced++
  }
  return synced
}
