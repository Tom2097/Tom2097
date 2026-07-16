import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { getServiceMetrics } from "@/lib/observability/dashboard"

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const { searchParams } = new URL(request.url)
    const service = searchParams.get("service")
    if (!service) {
      return NextResponse.json({ error: "service query parameter is required" }, { status: 400 })
    }
    const period = (searchParams.get("period") as "1h" | "24h" | "7d") || "24h"
    const metrics = await getServiceMetrics(service, period)
    return NextResponse.json(metrics)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
