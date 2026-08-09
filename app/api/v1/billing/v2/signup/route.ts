import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from "@/lib/auth/server-auth"
import { createPendingSubscription } from "@/lib/billing/signup"

/** Spec section 1, step 1: account/tenant already exist by this point
 *  (normal DigiT sign-up); this records the billing entity and creates the
 *  subscription row in "pending" status -- no product access yet. */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    await requireOwnerRole(user.id)

    const body = await request.json().catch(() => ({}))
    const { legalName, billingEmail, country, billingAddress, invoiceAddress, vatGstId } = body

    if (!legalName || !billingEmail || !country) {
      return NextResponse.json({ error: "legalName, billingEmail, and country are required" }, { status: 400 })
    }

    const subscriptionId = await createPendingSubscription(organizationId, {
      legalName, billingEmail, country, billingAddress, invoiceAddress, vatGstId,
    })

    if (!subscriptionId) {
      return NextResponse.json({ error: "Failed to create billing account" }, { status: 400 })
    }

    return NextResponse.json({ subscriptionId, status: "pending" })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
