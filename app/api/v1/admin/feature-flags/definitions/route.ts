import { NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { FEATURE_FLAG_DEFINITIONS } from "@/lib/feature-flags/admin"

export async function GET() {
  try {
    await getAuthenticatedUser()
    return NextResponse.json({ definitions: FEATURE_FLAG_DEFINITIONS })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
