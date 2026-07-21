import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { expireAllDueTrials } from "@/lib/billing/subscription-lifecycle"

/**
 * Scheduled: expires every subscription still in "trialing" whose
 * trial_ends_at has passed, so orgs that never make an authenticated
 * request (and so never hit the lazy check in getAuthenticatedUser()) don't
 * keep paid access forever. Auth: Authorization: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await expireAllDueTrials()
  return NextResponse.json(result)
}
