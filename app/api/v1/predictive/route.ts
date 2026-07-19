import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { ingestTelemetry, calculateRUL, getMaintenanceSchedule } from "@/lib/predictive/maintenance"

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const body = await req.json()
    const success = await ingestTelemetry(body, organizationId)
    if (!success) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }
    return NextResponse.json({ success })
  } catch (err) {
    return handleAuthError(err as Error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get("assetId")
    if (assetId) {
      try {
        const rul = await calculateRUL(assetId, organizationId)
        return NextResponse.json({ rul })
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Asset not found")) {
          return NextResponse.json({ error: "Asset not found" }, { status: 404 })
        }
        throw error
      }
    }
    const schedule = await getMaintenanceSchedule(organizationId)
    return NextResponse.json({ schedule })
  } catch (err) {
    return handleAuthError(err as Error)
  }
}
