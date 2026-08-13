import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { getRealPredictions } from "@/lib/analytics/predictions"

/** Real predictions for the Intelligence Hub's Predictions tab -- see
 *  lib/analytics/predictions.ts for what each figure is actually derived
 *  from and why. */
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const predictions = await getRealPredictions(organizationId)
    return NextResponse.json({ predictions })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
