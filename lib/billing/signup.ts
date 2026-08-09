import { createServiceClient } from "@/lib/supabase/service"
import { LIST_PRICE_CENTS, FOUNDING_PRICE_CENTS, FOUNDING_TRIAL_DAYS, STANDARD_TRIAL_DAYS, INSTALMENT_COUNT } from "@/lib/products"

export type BillingMode = "one_time" | "split"

export interface ActivateTrialResult {
  isFounding: boolean
  lockedPriceCents: number
  trialEndsAt: string
  billingMode: BillingMode
}

/**
 * The core state transition: pending -> trialing, on successful payment-
 * method confirmation (spec section 1, step 3->4 -- "the trial activates
 * only on confirmation"). Deliberately has NO Stripe import: it takes an
 * already-confirmed payment method as a precondition (the caller in
 * lib/billing/signup-stripe.ts is what actually talks to Stripe), so this
 * orchestration -- the founding-slot claim, price lock, instalment
 * schedule generation -- is testable without a live Stripe call or the
 * 'server-only' constraint that file carries.
 */
export async function activateTrial(
  organizationId: string,
  subscriptionId: string,
  billingModeRequested: BillingMode,
): Promise<ActivateTrialResult> {
  const db = createServiceClient()

  // Race-safe atomic claim (claim_founding_slot RPC -- see
  // 20260904000000_pricing_v2.sql). Founding customers always pay
  // one-time (spec's own stated assumption for open question #2 -- "the
  // brief offers split only for customer 51+").
  //
  // claim_founding_slot is declared RETURNS INT (a scalar), so
  // supabase-js's .rpc() hands back the number directly -- not an array,
  // unlike a RETURNS SETOF/TABLE function. It returns null when every slot
  // is already claimed (the UPDATE's subquery matches zero rows).
  const { data: claimResult } = await db.rpc("claim_founding_slot", {
    p_subscription_id: subscriptionId,
    p_organization_id: organizationId,
  })
  const claimedSlot = typeof claimResult === "number" ? claimResult : null
  const isFounding = claimedSlot !== null

  const lockedPriceCents = isFounding ? FOUNDING_PRICE_CENTS : LIST_PRICE_CENTS
  const trialDays = isFounding ? FOUNDING_TRIAL_DAYS : STANDARD_TRIAL_DAYS
  const billingMode: BillingMode = isFounding ? "one_time" : billingModeRequested

  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)

  await db
    .from("subscriptions")
    .update({
      status: "trialing",
      plan_id: "digit_annual",
      is_founding: isFounding,
      founding_slot: claimedSlot,
      locked_price_cents: lockedPriceCents,
      billing_mode: billingMode,
      trial_start: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .eq("id", subscriptionId)
    .eq("organization_id", organizationId)

  if (billingMode === "split") {
    await generateInstalmentSchedule(organizationId, subscriptionId, lockedPriceCents, trialEndsAt)
  }

  return { isFounding, lockedPriceCents, trialEndsAt: trialEndsAt.toISOString(), billingMode }
}

/**
 * Generates all 12 instalment rows up front (spec section 4: "store the
 * schedule, don't recompute it"). Reconciles exactly to lockedPriceCents:
 * 11 instalments of floor(price/12), and a final instalment that absorbs
 * whatever the floor division dropped -- never silent over/under-collection.
 * The first instalment is due AT TRIAL END (spec: "the charge fires
 * automatically at trial end -- ...or the first instalment for split
 * payers"), each subsequent one a month later.
 */
async function generateInstalmentSchedule(
  organizationId: string,
  subscriptionId: string,
  lockedPriceCents: number,
  firstDueDate: Date,
): Promise<void> {
  const db = createServiceClient()
  const base = Math.floor(lockedPriceCents / INSTALMENT_COUNT)
  const finalAmount = lockedPriceCents - base * (INSTALMENT_COUNT - 1)

  const rows = Array.from({ length: INSTALMENT_COUNT }, (_, i) => {
    const sequence = i + 1
    const dueDate = new Date(firstDueDate)
    dueDate.setMonth(dueDate.getMonth() + i)
    return {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      sequence,
      due_date: dueDate.toISOString(),
      amount_cents: sequence === INSTALMENT_COUNT ? finalAmount : base,
      status: "scheduled" as const,
    }
  })

  await db.from("instalment_schedule").insert(rows)
}

/** Creates the pending subscription + billing_account row at sign-up
 *  (spec section 1, step 1: "account and tenant created, status = pending,
 *  no access yet"). Organization creation itself is handled by the
 *  existing signup flow (app/api/auth/sign-up, app/auth/callback) -- this
 *  is called once an organization_id already exists. */
export async function createPendingSubscription(
  organizationId: string,
  billingAccount: {
    legalName: string
    billingEmail: string
    country: string
    billingAddress?: Record<string, unknown>
    invoiceAddress?: Record<string, unknown> | null
    vatGstId?: string | null
  },
): Promise<string | null> {
  const db = createServiceClient()

  const { data: account, error: accountError } = await db
    .from("billing_accounts")
    .upsert(
      {
        organization_id: organizationId,
        legal_name: billingAccount.legalName,
        billing_email: billingAccount.billingEmail,
        country: billingAccount.country,
        billing_address: billingAccount.billingAddress ?? {},
        invoice_address: billingAccount.invoiceAddress ?? null,
        vat_gst_id: billingAccount.vatGstId ?? null,
      },
      { onConflict: "organization_id" },
    )
    .select("id")
    .single()
  if (accountError || !account) return null

  const { data: existingSub } = await db
    .from("subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existingSub) {
    await db.from("subscriptions").update({ billing_account_id: account.id, status: "pending" }).eq("id", existingSub.id)
    return existingSub.id as string
  }

  const { data: sub, error: subError } = await db
    .from("subscriptions")
    .insert({ organization_id: organizationId, billing_account_id: account.id, plan_id: "digit_annual", status: "pending" })
    .select("id")
    .single()
  if (subError || !sub) return null
  return sub.id as string
}
