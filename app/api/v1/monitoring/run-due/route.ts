import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { runDueChecks } from "@/lib/monitoring/engine"

/** Scheduled: runs all due monitor checks. Auth: Authorization: Bearer CRON_SECRET. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const summary = await runDueChecks()
  return NextResponse.json({ summary })
}
