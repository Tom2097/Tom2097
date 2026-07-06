import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { checkFeatureAccess, type FeatureId } from "@/lib/entitlements/gate"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { feature } = await request.json()
    
    if (!feature) {
      return NextResponse.json({ error: "Feature is required" }, { status: 400 })
    }
    
    const result = await checkFeatureAccess(organizationId, feature as FeatureId)
    return NextResponse.json(result)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
