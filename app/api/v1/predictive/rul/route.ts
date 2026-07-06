import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { calculateRUL, getMaintenanceSchedule, detectAnomalies } from "@/lib/predictive/maintenance"

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)

    const assetId = searchParams.get("assetId")

    if (assetId) {
      const [rul, alerts] = await Promise.all([
        calculateRUL(assetId),
        detectAnomalies(assetId),
      ])
      return NextResponse.json({ rul, alerts })
    }

    const schedule = await getMaintenanceSchedule(organizationId)
    return NextResponse.json({ schedule })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
