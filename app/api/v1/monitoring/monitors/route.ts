import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createMonitor, listMonitors, validateMonitor } from "@/lib/monitoring/engine"
import type { ListMonitorsOptions, MonitorInput, MonitorStatus } from "@/lib/monitoring/types"

/**
 * GET /api/v1/monitoring/monitors
 * List monitors for the caller's org. Requires monitoring:read.
 * Query: ?limit=&offset=&enabled=true&status=up|down|degraded|unknown
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListMonitorsOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      enabledOnly: sp.get("enabled") === "true",
      status: (sp.get("status") as MonitorStatus | null) ?? undefined,
    }
    try {
      const result = await listMonitors(organizationId, opts)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list monitors"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:read"] },
)

/**
 * POST /api/v1/monitoring/monitors
 * Create a monitor. Requires monitoring:write.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const invalid = validateMonitor(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const created = await createMonitor(organizationId, userId, body as unknown as MonitorInput)
      await logAuthEvent({
        action: "monitor.created",
        userId,
        organizationId,
        resourceType: "monitor",
        resourceId: created.id,
        metadata: { type: created.type, target: created.target },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ monitor: created }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create monitor"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:write"] },
)

export { list as GET, create as POST }
