import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { addIncidentEvent, listIncidentEvents } from "@/lib/monitoring/engine"
import type { IncidentStatus } from "@/lib/monitoring/types"

/** Extract the incident id from /api/v1/monitoring/incidents/:id/events. */
function incidentIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("incidents")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET /api/v1/monitoring/incidents/:id/events — timeline. Requires monitoring:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = incidentIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const events = await listIncidentEvents(organizationId, id)
      return NextResponse.json({ events })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list events"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:read"] },
)

/**
 * POST /api/v1/monitoring/incidents/:id/events — add a timeline update (optionally
 * with a status transition). Requires monitoring:manage.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = incidentIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: { message?: string; status?: IncidentStatus }
    try {
      body = (await req.json()) as { message?: string; status?: IncidentStatus }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!body?.message || !body.message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    try {
      const event = await addIncidentEvent(organizationId, id, userId, body.message, body.status)
      if (!event) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: body.status === "resolved" ? "incident.resolved" : "incident.updated",
        userId,
        organizationId,
        resourceType: "incident",
        resourceId: id,
        metadata: { status: body.status ?? null },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ event }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to add event"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:manage"] },
)

export { list as GET, create as POST }
