import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from "@/lib/auth/server-auth"
import { createSetupIntentForOrg } from "@/lib/billing/signup-stripe"

/** Spec section 1, step 2-3: creates a SetupIntent -- authorizes a
 *  payment method (card, Apple Pay, Google Pay, SEPA -- whichever the
 *  client's Payment Element shows, driven by Stripe Dashboard config) with
 *  zero money taken. The client confirms it with Stripe.js; POST
 *  /confirm below re-verifies success server-side afterward. */
export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    await requireOwnerRole(user.id)

    const { clientSecret } = await createSetupIntentForOrg(organizationId, user.email)
    if (!clientSecret) {
      return NextResponse.json({ error: "Failed to create setup intent" }, { status: 400 })
    }

    return NextResponse.json({ clientSecret })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
