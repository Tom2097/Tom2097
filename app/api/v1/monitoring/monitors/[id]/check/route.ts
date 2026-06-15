import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { listChecks, recordCheck } from "@/lib/monitoring/engine"
import type { CheckResult } from "@/lib/monitoring/types"

/** Extract the monitor id from /api/v1/monitoring/monitors/:id/check. */
function monitorIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("monitors")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * GET /api/v1/monitoring/monitors/:id/check — recent check history.
 * Requires monitoring:read. Query: ?limit=
 */
const history = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = monitorIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1), 1000)
    try {
      const checks = await listChecks(organizationId, id, limit)
      return NextResponse.json({ checks })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list checks"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:read"] },
)

/**
 * POST /api/v1/monitoring/monitors/:id/check — run a check now (or record a
 * heartbeat ping if a `result` is supplied). Requires monitoring:write.
 */
const run = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = monitorIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let provided: CheckResult | undefined
    try {
      const text = await req.text()
      if (text.trim()) {
        const body = JSON.parse(text) as { result?: CheckResult }
        provided = body.result
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
      const outcome = await recordCheck(organizationId, id, provided)
      if (!outcome) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "monitor.checked",
        userId,
        organizationId,
        resourceType: "monitor",
        resourceId: id,
        metadata: { status: outcome.result.status, latency_ms: outcome.result.latency_ms },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ monitor: outcome.monitor, check: outcome.check })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to run check"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:write"] },
)

export { history as GET, run as POST }
