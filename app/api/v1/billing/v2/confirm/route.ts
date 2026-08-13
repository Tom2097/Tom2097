import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from "@/lib/auth/server-auth"
import { confirmSetupIntentAndSavePaymentMethod, createMonthlyStripeSubscription } from "@/lib/billing/signup-stripe"
import { activateTrial, type BillingInterval } from "@/lib/billing/signup"
import { createServiceClient } from "@/lib/supabase/service"

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

    if (!setupIntentId) {
      return NextResponse.json({ error: "setupIntentId is required" }, { status: 400 })
    }
    if (!VALID_INTERVALS.includes(billingInterval as BillingInterval)) {
      return NextResponse.json({ error: "billingInterval must be 'year' or 'month'" }, { status: 400 })
    }

    const confirmed = await confirmSetupIntentAndSavePaymentMethod(organizationId, setupIntentId)
    if (!confirmed) {
      return NextResponse.json({ error: "Payment method could not be confirmed" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data: sub } = await db
      .from("subscriptions")
      .select("id, stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (!sub || !sub.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found -- call /signup first" }, { status: 400 })
    }

    const result = await activateTrial(organizationId, sub.id as string, billingInterval as BillingInterval)

    if (billingInterval === "month") {
      const stripeSubscriptionId = await createMonthlyStripeSubscription(
        organizationId,
        sub.stripe_customer_id as string,
        confirmed.paymentMethodId,
        new Date(result.trialEndsAt),
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
