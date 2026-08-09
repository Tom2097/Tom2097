import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { sendDueTrialReminders } from "@/lib/billing/reminders"

/** Scheduled: spec section 1, step 5 -- 7-day and 1-day trial-end
 *  reminders. Not optional per the spec (legal requirement in several
 *  jurisdictions before a post-trial charge). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await sendDueTrialReminders()
  return NextResponse.json(result)
}
