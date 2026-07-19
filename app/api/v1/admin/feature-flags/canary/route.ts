import { NextResponse } from "next/server"
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { requireIpAllowlisted } from "@/lib/auth/ip-allowlist"
import { setCanaryPercentage } from "@/lib/feature-flags/admin"
import type { FeatureFlag } from "@/lib/feature-flags"

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    await requireIpAllowlisted(request)
    const { flag, percent } = (await request.json()) as { flag?: FeatureFlag; percent?: number }
    if (!flag || typeof percent !== "number") {
      return NextResponse.json({ error: "flag and percent are required" }, { status: 400 })
    }
    const ok = await setCanaryPercentage(flag, percent)
    if (!ok) return NextResponse.json({ error: "failed to update canary percentage" }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
