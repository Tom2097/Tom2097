import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { ingestTelemetry, calculateRUL, getMaintenanceSchedule } from "@/lib/predictive/maintenance"

export async function POST(req: NextRequest) {
  try {
    await getAuthenticatedUser()
    const body = await req.json()
    const success = await ingestTelemetry(body)
    return NextResponse.json({ success })
  } catch (err) {
    return handleAuthError(err as Error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get("assetId")
    if (assetId) {
      const rul = await calculateRUL(assetId)
      return NextResponse.json({ rul })
    }
    const schedule = await getMaintenanceSchedule(user.id)
    return NextResponse.json({ schedule })
  } catch (err) {
    return handleAuthError(err as Error)
  }
}
