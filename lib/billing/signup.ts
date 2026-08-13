import { createServiceClient } from "@/lib/supabase/service"
import { ANNUAL_PRICE_CENTS, MONTHLY_PRICE_CENTS, STANDARD_TRIAL_DAYS } from "@/lib/products"

export type BillingInterval = "year" | "month"

export interface ActivateTrialResult {
  billingInterval: BillingInterval
  lockedPriceCents: number
  trialEndsAt: string
}

/**
 * The core state transition: pending -> trialing, on successful payment-
 * method confirmation ("the trial activates only on confirmation").
 * Deliberately has NO Stripe import: it takes an already-confirmed payment
 * method as a precondition (the caller in lib/billing/signup-stripe.ts is
 * what actually talks to Stripe -- for the monthly interval, that's where
 * the real recurring Stripe Subscription gets created, using the
 * trialEndsAt this function returns), so this DB-only orchestration is
 * testable without a live Stripe call or the 'server-only' constraint that
 * file carries.
 */
export async function activateTrial(
  organizationId: string,
  subscriptionId: string,
  billingInterval: BillingInterval,
): Promise<ActivateTrialResult> {
  const db = createServiceClient()

  const lockedPriceCents = billingInterval === "month" ? MONTHLY_PRICE_CENTS : ANNUAL_PRICE_CENTS
  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + STANDARD_TRIAL_DAYS * 24 * 60 * 60 * 1000)

  await db
    .from("subscriptions")
    .update({
      status: "trialing",
      plan_id: "digit_annual",
      billing_interval: billingInterval,
      locked_price_cents: lockedPriceCents,
      billing_mode: billingInterval === "year" ? "one_time" : null,
      trial_start: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .eq("id", subscriptionId)
    .eq("organization_id", organizationId)

  return { billingInterval, lockedPriceCents, trialEndsAt: trialEndsAt.toISOString() }
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
