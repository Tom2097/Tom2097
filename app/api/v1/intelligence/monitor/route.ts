import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { runAllMonitors, getMonitorStatus } from "@/lib/intelligence/monitor"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rateLimited = await checkTenantRateLimit(ctx.organizationId, 60, 10)
  if (rateLimited) return rateLimited

  const checks = await runAllMonitors(ctx.organizationId)
  const summary = getMonitorStatus(checks)

  return NextResponse.json({ checks, summary })
}
