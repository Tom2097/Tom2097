import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { getEntitlements } from "@/lib/entitlements/gate"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    
    const { createServiceClient } = await import("@/lib/supabase/service")
    const supabase = await createServiceClient()
    
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id")
      .eq("organization_id", organizationId)
      .single()
    
    if (!sub) {
      return NextResponse.json({ entitlements: [] })
    }
    
    const entitlements = getEntitlements(sub.plan_id)
    return NextResponse.json({ plan: sub.plan_id, entitlements })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
