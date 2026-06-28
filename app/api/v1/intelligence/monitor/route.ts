import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { runAllMonitors, getMonitorStatus } from "@/lib/intelligence/monitor"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const checks = await runAllMonitors(ctx.organizationId)
  const summary = getMonitorStatus(checks)

  return NextResponse.json({ checks, summary })
}
