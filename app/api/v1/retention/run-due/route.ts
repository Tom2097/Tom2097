import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { runDuePolicies } from "@/lib/retention/engine"

/** Scheduled: runs all due retention policies. Auth: Authorization: Bearer CRON_SECRET. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const results = await runDuePolicies()
  return NextResponse.json({ results })
}
