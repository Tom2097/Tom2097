import { NextResponse } from "next/server"
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { requireIpAllowlisted } from "@/lib/auth/ip-allowlist"
import { getObservabilitySummary } from "@/lib/observability/dashboard"

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    await requireIpAllowlisted(request)
    const summary = await getObservabilitySummary()
    return NextResponse.json(summary)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
