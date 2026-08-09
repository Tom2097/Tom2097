import { createServiceClient } from "@/lib/supabase/service"
import { formatPrice } from "@/lib/products"

/**
 * Spec section 1, step 5: emails at 7 days and 1 day before the trial
 * ends, stating the exact amount and date of the charge -- "not optional:
 * in several jurisdictions advance notice before a post-trial charge is a
 * legal requirement, and it sharply reduces chargebacks."
 *
 * Uses the same Resend pattern already established in
 * lib/analytics/reports-schedule.ts. reminder_7d_sent_at/reminder_1d_sent_at
 * (added in 20260904000000_pricing_v2.sql) make each reminder idempotent --
 * a sweep that runs more than once a day, or catches up after downtime,
 * never double-sends.
 */
export async function sendDueTrialReminders(): Promise<{ sent7d: number; sent1d: number }> {
  const db = createServiceClient()
  const now = Date.now()

  const sevenDayWindowStart = new Date(now + 6 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDayWindowEnd = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayWindowStart = new Date(now + 0 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayWindowEnd = new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString()

  const { data: due7d } = await db
    .from("subscriptions")
    .select("id, organization_id, trial_ends_at, locked_price_cents, billing_mode")
    .eq("status", "trialing")
    .is("reminder_7d_sent_at", null)
    .gte("trial_ends_at", sevenDayWindowStart)
    .lt("trial_ends_at", sevenDayWindowEnd)

  const { data: due1d } = await db
    .from("subscriptions")
    .select("id, organization_id, trial_ends_at, locked_price_cents, billing_mode")
    .eq("status", "trialing")
    .is("reminder_1d_sent_at", null)
    .gte("trial_ends_at", oneDayWindowStart)
    .lt("trial_ends_at", oneDayWindowEnd)

  let sent7d = 0
  let sent1d = 0

  for (const sub of due7d ?? []) {
    const ok = await sendReminderEmail(sub)
    if (ok) {
      await db.from("subscriptions").update({ reminder_7d_sent_at: new Date().toISOString() }).eq("id", sub.id)
      sent7d++
    }
  }

  for (const sub of due1d ?? []) {
    const ok = await sendReminderEmail(sub)
    if (ok) {
      await db.from("subscriptions").update({ reminder_1d_sent_at: new Date().toISOString() }).eq("id", sub.id)
      sent1d++
    }
  }

  return { sent7d, sent1d }
}

interface ReminderSubscription {
  id: string
  organization_id: string
  trial_ends_at: string
  locked_price_cents: number | null
  billing_mode: string | null
}

async function sendReminderEmail(sub: ReminderSubscription): Promise<boolean> {
  const db = createServiceClient()
  const { data: account } = await db
    .from("billing_accounts")
    .select("billing_email")
    .eq("organization_id", sub.organization_id)
    .maybeSingle()
  if (!account?.billing_email) return false

  const amountCents = sub.billing_mode === "split" && sub.locked_price_cents
    ? Math.floor(sub.locked_price_cents / 12)
    : sub.locked_price_cents ?? 0
  const amountLabel = sub.billing_mode === "split"
    ? `${formatPrice(amountCents)} (first of 12 monthly instalments)`
    : formatPrice(amountCents)
  const chargeDate = new Date(sub.trial_ends_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "billing@digit.app",
        to: account.billing_email,
        subject: `Your DigiT trial ends ${chargeDate} -- ${amountLabel} will be charged`,
        html: `<p>Your DigiT free trial ends on <strong>${chargeDate}</strong>.</p><p>On that date, <strong>${amountLabel}</strong> will be charged automatically to your payment method on file.</p><p>No action is needed if you'd like to continue. To cancel before the charge, visit your billing settings.</p>`,
      }),
    })
    return true
  } catch {
    return false
  }
}
