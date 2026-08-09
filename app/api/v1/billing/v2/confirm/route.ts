import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from "@/lib/auth/server-auth"
import { confirmSetupIntentAndSavePaymentMethod } from "@/lib/billing/signup-stripe"
import { activateTrial, type BillingMode } from "@/lib/billing/signup"
import { createServiceClient } from "@/lib/supabase/service"

const VALID_MODES: BillingMode[] = ["one_time", "split"]

/** Spec section 1, step 3->4: re-verifies the SetupIntent actually
 *  succeeded (never trust the browser redirect alone), then activates the
 *  trial -- founding-slot claim, price lock, trial length by cohort. This
 *  is the one moment "no confirmed payment method = no trial" is enforced:
 *  if confirmSetupIntentAndSavePaymentMethod returns null, nothing below
 *  it ever runs. */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    await requireOwnerRole(user.id)

    const body = await request.json().catch(() => ({}))
    const setupIntentId = body.setupIntentId as string | undefined
    const billingMode = (body.billingMode as string | undefined) ?? "one_time"

    if (!setupIntentId) {
      return NextResponse.json({ error: "setupIntentId is required" }, { status: 400 })
    }
    if (!VALID_MODES.includes(billingMode as BillingMode)) {
      return NextResponse.json({ error: "billingMode must be 'one_time' or 'split'" }, { status: 400 })
    }

    const confirmed = await confirmSetupIntentAndSavePaymentMethod(organizationId, setupIntentId)
    if (!confirmed) {
      return NextResponse.json({ error: "Payment method could not be confirmed" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data: sub } = await db
      .from("subscriptions")
      .select("id")
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (!sub) {
      return NextResponse.json({ error: "No subscription found -- call /signup first" }, { status: 400 })
    }

    const result = await activateTrial(organizationId, sub.id as string, billingMode as BillingMode)

    return NextResponse.json({ status: "trialing", ...result })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
