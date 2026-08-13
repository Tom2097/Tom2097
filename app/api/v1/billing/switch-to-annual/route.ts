import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requireOwnerRole, handleAuthError } from "@/lib/auth/server-auth"
import { switchToAnnual } from "@/lib/billing/switch-plan"

/** Self-service monthly -> annual upgrade -- see lib/billing/switch-plan.ts
 *  for the charge-then-convert ordering. */
export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    await requireOwnerRole(user.id)

    const result = await switchToAnnual(organizationId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
