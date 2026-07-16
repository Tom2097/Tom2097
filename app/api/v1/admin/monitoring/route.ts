import { NextResponse } from "next/server"
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { getObservabilitySummary } from "@/lib/observability/dashboard"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const summary = await getObservabilitySummary()
    return NextResponse.json(summary)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
