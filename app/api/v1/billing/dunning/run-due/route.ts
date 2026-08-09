import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { retryAllDueDunning } from "@/lib/billing/dunning"

/**
 * Scheduled: retries every past_due subscription whose next dunning attempt
 * (lib/billing/dunning.ts's recordFailedPayment-scheduled next_attempt_at)
 * is now due. Same auth convention as trials/run-due: Authorization: Bearer
 * CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await retryAllDueDunning()
  return NextResponse.json(result)
}
