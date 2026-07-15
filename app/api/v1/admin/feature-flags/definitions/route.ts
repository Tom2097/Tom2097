import { NextResponse } from "next/server"
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { FEATURE_FLAG_DEFINITIONS } from "@/lib/feature-flags/admin"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    return NextResponse.json({ definitions: FEATURE_FLAG_DEFINITIONS })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
