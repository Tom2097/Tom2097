import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { chargeAllDueTrials } from "@/lib/billing/charge"

/** Scheduled: spec section 1, step 6 -- the charge fires automatically at
 *  trial end. Same CRON_SECRET convention as trials/run-due,
 *  dunning/run-due, hitl/escalate-due. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await chargeAllDueTrials()
  return NextResponse.json(result)
}
