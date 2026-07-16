import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { listAllIncidents, getIncidentAnyOrg, createIncident, updateIncident } from "@/lib/monitoring/engine"
import type { IncidentSeverity, IncidentStatus } from "@/lib/monitoring/types"

const SEVERITY_ORDER: IncidentSeverity[] = ["low", "medium", "high", "critical"]

// This is a platform-wide, cross-tenant view (consistent with the other
// admin/* surfaces like Tenants/Impersonation/JIT) -- incidents belong to
// individual organizations' own monitors, but a platform admin needs to see
// and triage them across every tenant, not just their own org.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as IncidentStatus | null
    const { incidents, total } = await listAllIncidents({ status: status ?? undefined, limit: 200 })
    return NextResponse.json({ incidents, total })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const body = await request.json()
    const { action } = body as { action?: string }

    if (action === "report") {
      const organizationId = await getOrganizationId(user.id)
      const { title, description, severity } = body as { title?: string; description?: string; severity?: IncidentSeverity }
      if (!title || !title.trim()) {
        return NextResponse.json({ error: "title is required" }, { status: 400 })
      }
      const incident = await createIncident(organizationId, user.id, { title: title.trim(), summary: description?.trim() || null, severity })
      return NextResponse.json({ incident }, { status: 201 })
    }

    const { incidentId } = body as { incidentId?: string }
    if (!incidentId) return NextResponse.json({ error: "incidentId is required" }, { status: 400 })

    const existing = await getIncidentAnyOrg(incidentId)
    if (!existing) return NextResponse.json({ error: "incident not found" }, { status: 404 })

    let incident
    switch (action) {
      case "escalate": {
        const idx = SEVERITY_ORDER.indexOf(existing.severity)
        const nextSeverity = SEVERITY_ORDER[Math.min(idx + 1, SEVERITY_ORDER.length - 1)]
        incident = await updateIncident(existing.organization_id, incidentId, { severity: nextSeverity }, user.id, "Escalated by platform admin")
        break
      }
      case "resolve":
        incident = await updateIncident(existing.organization_id, incidentId, { status: "resolved" }, user.id, "Resolved by platform admin")
        break
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 })
    }

    if (!incident) return NextResponse.json({ error: "incident not found" }, { status: 404 })
    return NextResponse.json({ incident })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
