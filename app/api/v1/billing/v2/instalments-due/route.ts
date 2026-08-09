import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { chargeAllDueInstalments } from "@/lib/billing/charge"

/** Scheduled: charges each due instalment (sequence 2-12; sequence 1 fires
 *  at trial end via charge-due) for split payers. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await chargeAllDueInstalments()
  return NextResponse.json(result)
}
