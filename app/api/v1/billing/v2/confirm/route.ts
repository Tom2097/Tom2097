import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from "@/lib/auth/server-auth"
import { confirmSetupIntentAndSavePaymentMethod, createMonthlyStripeSubscription } from "@/lib/billing/signup-stripe"
import { activateTrial, type BillingInterval } from "@/lib/billing/signup"
import { createServiceClient } from "@/lib/supabase/service"
import { validateDiscountCode, recordDiscountUse, type DiscountConfig } from "@/lib/billing/discounts"

const VALID_INTERVALS: BillingInterval[] = ["year", "month"]

/** Re-verifies the SetupIntent actually succeeded (never trust the browser
 *  redirect alone), then activates the trial -- price lock by interval,
 *  and for "month", creates the real recurring Stripe Subscription (see
 *  lib/billing/signup-stripe.ts's createMonthlyStripeSubscription). This is
 *  the one moment "no confirmed payment method = no trial" is enforced: if
 *  confirmSetupIntentAndSavePaymentMethod returns null, nothing below it
 *  ever runs. */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    await requireOwnerRole(user.id)

    const body = await request.json().catch(() => ({}))
    const setupIntentId = body.setupIntentId as string | undefined
    const billingInterval = (body.billingInterval as string | undefined) ?? "year"
    const discountCode = typeof body.discountCode === "string" ? body.discountCode.trim() : ""

    if (!setupIntentId) {
      return NextResponse.json({ error: "setupIntentId is required" }, { status: 400 })
    }
    if (!VALID_INTERVALS.includes(billingInterval as BillingInterval)) {
      return NextResponse.json({ error: "billingInterval must be 'year' or 'month'" }, { status: 400 })
    }

    const db = createServiceClient()

    // A retry of this same confirmation (same SetupIntent) must reuse the
    // redemption it already claimed rather than be refused -- the claim may
    // have just used the code's last slot.
    let discount: DiscountConfig | undefined
    if (discountCode) {
      discount = await getPriorRedemption(db, organizationId, setupIntentId)
      if (!discount) {
        // Re-validate server-side before anything else changes: the
        // checkout UI pre-checks the code, but the browser is never trusted
        // for price.
        const validation = await validateDiscountCode(discountCode, "digit_annual")
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error || "Invalid discount code" }, { status: 400 })
        }
      }
    }

    const confirmed = await confirmSetupIntentAndSavePaymentMethod(organizationId, setupIntentId)
    if (!confirmed) {
      return NextResponse.json({ error: "Payment method could not be confirmed" }, { status: 400 })
    }

    const { data: sub } = await db
      .from("subscriptions")
      .select("id, stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (!sub || !sub.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found -- call /signup first" }, { status: 400 })
    }

    // Claim the redemption now that a payment method is confirmed -- the
    // trial (and its locked price) starts here, so this is the commitment
    // point. redeem_discount_code() is atomic and keyed on the SetupIntent
    // id, so a retried request can't claim twice.
    if (discountCode && !discount) {
      const claim = await recordDiscountUse(discountCode, organizationId, setupIntentId)
      if (!claim.claimed || !claim.discount) {
        return NextResponse.json({ error: "This discount code is no longer available" }, { status: 400 })
      }
      discount = claim.discount
    }

    const result = await activateTrial(organizationId, sub.id as string, billingInterval as BillingInterval, discount)

    if (discount) {
      await db.from("billing_events").insert({
        organization_id: organizationId,
        event_type: "discount_applied",
        provider: "stripe",
        metadata: { code: discount.code, type: discount.type, value: discount.value, plan_id: "digit_annual", billing_interval: billingInterval, locked_price_cents: result.lockedPriceCents },
      })
    }

    if (billingInterval === "month") {
      const stripeSubscriptionId = await createMonthlyStripeSubscription(
        organizationId,
        sub.stripe_customer_id as string,
        confirmed.paymentMethodId,
        new Date(result.trialEndsAt),
        result.lockedPriceCents,
      )
      await db
        .from("subscriptions")
        .update({ stripe_subscription_id: stripeSubscriptionId })
        .eq("id", sub.id)
    }

    return NextResponse.json({ status: "trialing", ...result })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

async function getPriorRedemption(
  db: ReturnType<typeof createServiceClient>,
  organizationId: string,
  setupIntentId: string,
): Promise<DiscountConfig | undefined> {
  const { data: redemption } = await db
    .from("discount_redemptions")
    .select("code")
    .eq("organization_id", organizationId)
    .eq("stripe_checkout_session_id", setupIntentId)
    .maybeSingle()
  if (!redemption) return undefined

  const { data: row } = await db
    .from("discount_codes")
    .select("code, discount_type, value")
    .eq("code", redemption.code)
    .maybeSingle()
  if (!row) return undefined

  return {
    code: row.code as string,
    type: row.discount_type as DiscountConfig["type"],
    value: Number(row.value),
    maxUses: 0,
    currentUses: 0,
    expiresAt: null,
  }
}
