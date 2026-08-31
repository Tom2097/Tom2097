import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteMonitor, getMonitor, updateMonitor } from "@/lib/monitoring/engine"
import type { MonitorInput } from "@/lib/monitoring/types"

/** Extract the monitor id from /api/v1/monitoring/monitors/:id[/...]. */
function monitorIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("monitors")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET /api/v1/monitoring/monitors/:id — fetch one. Requires monitoring:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = monitorIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const monitor = await getMonitor(organizationId, id)
      if (!monitor) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ monitor })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch monitor"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:read"] },
)

/** PATCH /api/v1/monitoring/monitors/:id — edit config. Requires monitoring:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = monitorIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: MonitorInput
    try {
      body = (await req.json()) as MonitorInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
      const updated = await updateMonitor(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "monitor.updated",
        userId,
        organizationId,
        resourceType: "monitor",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ monitor: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update monitor"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:write"] },
)

/** DELETE /api/v1/monitoring/monitors/:id — remove. Requires monitoring:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = monitorIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteMonitor(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "monitor.deleted",
        userId,
        organizationId,
        resourceType: "monitor",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete monitor"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
