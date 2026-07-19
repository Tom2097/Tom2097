import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { ingestTelemetry, ingestBatchTelemetry } from "@/lib/predictive/maintenance"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const body = await request.json()

    if (Array.isArray(body)) {
      const count = await ingestBatchTelemetry(body, organizationId)
      return NextResponse.json({ ingested: count })
    }

    const success = await ingestTelemetry(body, organizationId)
    if (!success) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }
    return NextResponse.json({ success })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
