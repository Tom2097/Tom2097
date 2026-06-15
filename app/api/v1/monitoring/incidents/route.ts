import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createIncident, listIncidents } from "@/lib/monitoring/engine"
import type { IncidentInput, IncidentStatus, ListIncidentsOptions } from "@/lib/monitoring/types"

/**
 * GET /api/v1/monitoring/incidents
 * List incidents for the caller's org. Requires monitoring:read.
 * Query: ?limit=&offset=&status=&open=true
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListIncidentsOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      status: (sp.get("status") as IncidentStatus | null) ?? undefined,
      openOnly: sp.get("open") === "true",
    }
    try {
      const result = await listIncidents(organizationId, opts)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list incidents"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:read"] },
)

/**
 * POST /api/v1/monitoring/incidents
 * Open an incident manually. Requires monitoring:manage.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: IncidentInput
    try {
      body = (await req.json()) as IncidentInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!body?.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    try {
      const created = await createIncident(organizationId, userId, body)
      await logAuthEvent({
        action: "incident.created",
        userId,
        organizationId,
        resourceType: "incident",
        resourceId: created.id,
        metadata: { severity: created.severity, monitor_id: created.monitor_id },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ incident: created }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create incident"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:manage"] },
)

export { list as GET, create as POST }
