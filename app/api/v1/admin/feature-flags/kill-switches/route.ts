import { NextResponse } from "next/server"
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { requireIpAllowlisted } from "@/lib/auth/ip-allowlist"
import { getAllKillSwitches, setKillSwitch } from "@/lib/feature-flags/admin"
import type { FeatureFlag } from "@/lib/feature-flags"

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    await requireIpAllowlisted(request)
    const switches = await getAllKillSwitches()
    return NextResponse.json({ switches })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    await requireIpAllowlisted(request)
    const { flag, enabled } = (await request.json()) as { flag?: FeatureFlag; enabled?: boolean }
    if (!flag || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "flag and enabled are required" }, { status: 400 })
    }
    const ok = await setKillSwitch(flag, enabled)
    if (!ok) return NextResponse.json({ error: "failed to update kill switch" }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
