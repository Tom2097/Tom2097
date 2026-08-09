import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { escalateOverdueHARs } from "@/lib/hitl/har"

/**
 * Scheduled: the founder's Tier 1 default-timeout decision -- escalate to
 * the owner when a HAR's due_at passes with no response. Same auth
 * convention as trials/run-due and dunning/run-due: Authorization: Bearer
 * CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await escalateOverdueHARs()
  return NextResponse.json(result)
}
