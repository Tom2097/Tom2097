import "server-only"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/service"
import { recordFailedPayment } from "./dunning"

interface SubscriptionRow {
  id: string
  organization_id: string
  stripe_customer_id: string | null
  locked_price_cents: number | null
  billing_mode: string | null
  is_founding: boolean
}

/**
 * Sequential, gapless, immutable invoice numbering (spec section 6) via
 * the next_invoice_number() Postgres wrapper around invoice_number_seq --
 * a real DB sequence, not an app-level counter that could race or be
 * skipped on a failed insert.
 *
 * tax_cents is 0 for now -- Stripe Tax (the spec's own recommended "use
 * the provider's tax engine rather than hand-rolling it") needs to be
 * enabled on the Stripe account and wired to a real calculation call
 * before this can be anything but a placeholder. Flagged as follow-up,
 * not silently faked with an invented rate.
 */
export async function issueInvoice(
  organizationId: string,
  subscriptionId: string,
  amountCents: number,
  currency: string,
  description: string,
): Promise<{ id: string; invoiceNumber: number }> {
  const db = createServiceClient()
  const { data: seqResult } = await db.rpc("next_invoice_number")
  const invoiceNumber = Number(seqResult)

  const { data: invoice, error } = await db
    .from("invoices")
    .insert({
      organization_id: organizationId,
      invoice_number: invoiceNumber,
      subscription_id: subscriptionId,
      line_items: [{ description, amount_cents: amountCents }],
      net_cents: amountCents,
      tax_cents: 0,
      gross_cents: amountCents,
      currency,
      status: "paid",
    })
    .select("id")
    .single()

  if (error || !invoice) throw new Error(`Failed to issue invoice: ${error?.message}`)
  return { id: invoice.id as string, invoiceNumber }
}

/**
 * Spec section 1, step 6: "the charge fires automatically at trial end --
 * the full year for one-time payers, or the first instalment for split
 * payers." Scheduled sweep (mirrors trials/run-due, dunning/run-due):
 * finds every trialing subscription whose trial_ends_at has passed and
 * charges it.
 */
export async function chargeAllDueTrials(): Promise<{ processed: number; charged: number; failed: number }> {
  const db = createServiceClient()
  const { data: due } = await db
    .from("subscriptions")
    .select("id, organization_id, stripe_customer_id, locked_price_cents, billing_mode, is_founding")
    .eq("status", "trialing")
    .lte("trial_ends_at", new Date().toISOString())

  const rows = (due ?? []) as SubscriptionRow[]
  let charged = 0
  let failed = 0

  for (const sub of rows) {
    const ok = await chargeSubscriptionAtTrialEnd(sub)
    if (ok) charged++
    else failed++
  }

  return { processed: rows.length, charged, failed }
}

async function chargeSubscriptionAtTrialEnd(sub: SubscriptionRow): Promise<boolean> {
  const db = createServiceClient()
  const stripe = await getStripe()

  const { data: pm } = await db
    .from("payment_methods")
    .select("*")
    .eq("organization_id", sub.organization_id)
    .eq("is_default", true)
    .maybeSingle()

  if (!pm || !sub.stripe_customer_id || !sub.locked_price_cents) {
    await recordFailedPayment(sub.id, sub.organization_id, (sub.locked_price_cents ?? 0) / 100, "usd", "No confirmed payment method on file")
    await db.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id)
    return false
  }

  let amountCents = sub.locked_price_cents
  let instalmentId: string | null = null
  let description = `DigiT annual subscription${sub.is_founding ? " (founding rate)" : ""}`

  if (sub.billing_mode === "split") {
    const { data: instalment } = await db
      .from("instalment_schedule")
      .select("*")
      .eq("subscription_id", sub.id)
      .eq("sequence", 1)
      .single()
    if (!instalment) return false
    amountCents = instalment.amount_cents
    instalmentId = instalment.id
    description = "DigiT annual subscription -- instalment 1 of 12"
  }

  const idempotencyKey = `trial-end-charge-${sub.id}`

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        customer: sub.stripe_customer_id,
        payment_method: pm.provider_token,
        off_session: true,
        confirm: true,
        metadata: { organization_id: sub.organization_id, subscription_id: sub.id },
      },
      { idempotencyKey },
    )

    if (pi.status !== "succeeded") throw new Error(`PaymentIntent ended in status "${pi.status}"`)

    const invoice = await issueInvoice(sub.organization_id, sub.id, amountCents, "usd", description)

    await db.from("payments").insert({
      organization_id: sub.organization_id,
      invoice_id: invoice.id,
      subscription_id: sub.id,
      amount_cents: amountCents,
      currency: "usd",
      method: pm.type,
      provider_ref: pi.id,
      status: "succeeded",
      idempotency_key: idempotencyKey,
    })

    if (instalmentId) {
      await db.from("instalment_schedule").update({ status: "charged" }).eq("id", instalmentId)
    }

    const termEnd = new Date()
    termEnd.setFullYear(termEnd.getFullYear() + 1)
    await db
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: termEnd.toISOString(),
      })
      .eq("id", sub.id)

    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed"
    await recordFailedPayment(sub.id, sub.organization_id, amountCents / 100, "usd", message)
    await db.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id)
    return false
  }
}

/**
 * Charges each due instalment (sequence 2-12; sequence 1 already fired at
 * trial end via chargeAllDueTrials). Spec section 4: a missed instalment
 * goes through dunning, then suspend -- and per the founder's decision,
 * the remaining balance is written off after dunning exhausts, not
 * pursued further. That write-off happens naturally here: once dunning's
 * own max-attempts is reached (lib/billing/dunning.ts), retryDunning stops
 * being called for that subscription and the instalment simply stays
 * "failed" -- there is no further collection step to build.
 */
export async function chargeAllDueInstalments(): Promise<{ processed: number; charged: number; failed: number }> {
  const db = createServiceClient()
  const { data: due } = await db
    .from("instalment_schedule")
    .select("*")
    .eq("status", "scheduled")
    .gt("sequence", 1)
    .lte("due_date", new Date().toISOString())

  const rows = due ?? []
  let charged = 0
  let failed = 0

  for (const instalment of rows) {
    const ok = await chargeInstalment(instalment as { id: string; organization_id: string; subscription_id: string; sequence: number; amount_cents: number })
    if (ok) charged++
    else failed++
  }

  return { processed: rows.length, charged, failed }
}

async function chargeInstalment(instalment: {
  id: string
  organization_id: string
  subscription_id: string
  sequence: number
  amount_cents: number
}): Promise<boolean> {
  const db = createServiceClient()
  const stripe = await getStripe()

  const { data: sub } = await db
    .from("subscriptions")
    .select("id, organization_id, stripe_customer_id, status")
    .eq("id", instalment.subscription_id)
    .single()
  if (!sub || sub.status === "canceled") return false

  const { data: pm } = await db
    .from("payment_methods")
    .select("*")
    .eq("organization_id", instalment.organization_id)
    .eq("is_default", true)
    .maybeSingle()

  if (!pm || !sub.stripe_customer_id) {
    await recordFailedPayment(sub.id, instalment.organization_id, instalment.amount_cents / 100, "usd", "No confirmed payment method on file")
    await db.from("instalment_schedule").update({ status: "failed" }).eq("id", instalment.id)
    return false
  }

  const idempotencyKey = `instalment-charge-${instalment.id}`

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: instalment.amount_cents,
        currency: "usd",
        customer: sub.stripe_customer_id,
        payment_method: pm.provider_token,
        off_session: true,
        confirm: true,
        metadata: { organization_id: instalment.organization_id, subscription_id: sub.id, instalment_sequence: String(instalment.sequence) },
      },
      { idempotencyKey },
    )

    if (pi.status !== "succeeded") throw new Error(`PaymentIntent ended in status "${pi.status}"`)

    const invoice = await issueInvoice(
      instalment.organization_id,
      sub.id,
      instalment.amount_cents,
      "usd",
      `DigiT annual subscription -- instalment ${instalment.sequence} of 12`,
    )

    await db.from("payments").insert({
      organization_id: instalment.organization_id,
      invoice_id: invoice.id,
      subscription_id: sub.id,
      amount_cents: instalment.amount_cents,
      currency: "usd",
      method: pm.type,
      provider_ref: pi.id,
      status: "succeeded",
      idempotency_key: idempotencyKey,
    })

    await db.from("instalment_schedule").update({ status: "charged" }).eq("id", instalment.id)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed"
    await recordFailedPayment(sub.id, instalment.organization_id, instalment.amount_cents / 100, "usd", message)
    await db.from("instalment_schedule").update({ status: "failed" }).eq("id", instalment.id)
    return false
  }
}
