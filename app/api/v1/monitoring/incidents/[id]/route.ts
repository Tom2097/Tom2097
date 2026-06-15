import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { getIncident, updateIncident } from "@/lib/monitoring/engine"
import type { IncidentUpdateInput } from "@/lib/monitoring/types"

/** Extract the incident id from /api/v1/monitoring/incidents/:id[/...]. */
function incidentIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("incidents")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET /api/v1/monitoring/incidents/:id — fetch one. Requires monitoring:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = incidentIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const incident = await getIncident(organizationId, id)
      if (!incident) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ incident })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch incident"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:read"] },
)

/**
 * PATCH /api/v1/monitoring/incidents/:id — update status/severity/title/summary.
 * A `note` is recorded on the timeline. Requires monitoring:manage.
 */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = incidentIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: IncidentUpdateInput & { note?: string }
    try {
      body = (await req.json()) as IncidentUpdateInput & { note?: string }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
      const before = await getIncident(organizationId, id)
      if (!before) return NextResponse.json({ error: "not found" }, { status: 404 })

      const updated = await updateIncident(organizationId, id, body, userId, body.note)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })

      if (body.status !== undefined && body.status !== before.status) {
        await logAuthEvent({
          action: updated.status === "resolved" ? "incident.resolved" : "incident.updated",
          userId,
          organizationId,
          resourceType: "incident",
          resourceId: id,
          metadata: { from: before.status, to: updated.status },
          ipAddress: getClientIp(req.headers),
        })
      } else {
        await logAuthEvent({
          action: "incident.updated",
          userId,
          organizationId,
          resourceType: "incident",
          resourceId: id,
          metadata: { fields: Object.keys(body ?? {}) },
          ipAddress: getClientIp(req.headers),
        })
      }

      return NextResponse.json({ incident: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update incident"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:manage"] },
)

export { get as GET, patch as PATCH }
