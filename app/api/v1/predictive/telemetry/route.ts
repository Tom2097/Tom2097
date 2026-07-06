import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { ingestTelemetry, ingestBatchTelemetry } from "@/lib/predictive/maintenance"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = await request.json()

    if (Array.isArray(body)) {
      const count = await ingestBatchTelemetry(body)
      return NextResponse.json({ ingested: count })
    }

    const success = await ingestTelemetry(body)
    return NextResponse.json({ success })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
