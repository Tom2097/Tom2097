import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { runStalledDealCheck } from "@/lib/crm/stalled"

/** Scheduled: cross-tenant scan publishing deal.stalled for newly-stalled open deals. Auth: Authorization: Bearer CRON_SECRET. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const summary = await runStalledDealCheck()
  return NextResponse.json({ summary })
}

export const POST = GET
