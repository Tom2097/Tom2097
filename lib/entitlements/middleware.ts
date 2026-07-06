import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { NextResponse } from "next/server"
import type { FeatureId } from "./gate"

export function requireEntitlement(feature: FeatureId) {
  return async function entitlementGuard() {
    try {
      const user = await getAuthenticatedUser()
      const organizationId = await getOrganizationId(user.id)
      
      const { checkFeatureAccess } = await import("./gate")
      const result = await checkFeatureAccess(organizationId, feature)
      
      if (!result.entitled) {
        return NextResponse.json(
          { error: "Feature not available on your plan", upgrade: true, reason: result.reason },
          { status: 403 }
        )
      }
      
      return null
    } catch (error) {
      return handleAuthError(error as Error)
    }
  }
}
