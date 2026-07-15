import { NextResponse } from "next/server"
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { getGlobalFeatureFlags, setGlobalFeatureFlag } from "@/lib/feature-flags/admin"
import type { FeatureFlag } from "@/lib/feature-flags"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const flags = await getGlobalFeatureFlags()
    return NextResponse.json({ flags })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const { flag, value } = (await request.json()) as { flag?: FeatureFlag; value?: boolean }
    if (!flag || typeof value !== "boolean") {
      return NextResponse.json({ error: "flag and value are required" }, { status: 400 })
    }
    const ok = await setGlobalFeatureFlag(flag, value)
    if (!ok) return NextResponse.json({ error: "failed to update flag" }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
