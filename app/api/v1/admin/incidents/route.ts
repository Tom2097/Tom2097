import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, requirePlatformAdmin, handleAuthError } from "@/lib/auth/server-auth"
import { getIncidents, reportIncident, assignIncident, escalateIncident, resolveIncident } from "@/lib/incident/response"
import type { Incident } from "@/lib/incident/response"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const organizationId = await getOrganizationId(user.id)
    const incidents = await getIncidents(organizationId)
    return NextResponse.json({ incidents })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const organizationId = await getOrganizationId(user.id)
    const body = await request.json()
    const { action } = body as { action?: string }

    if (action === "report") {
      const { title, description, severity } = body as {
        title?: string
        description?: string
        severity?: Incident["severity"]
      }
      if (!title || !title.trim()) {
        return NextResponse.json({ error: "title is required" }, { status: 400 })
      }
      const incident = await reportIncident(organizationId, title.trim(), description?.trim() || "", severity || "medium")
      if (!incident) return NextResponse.json({ error: "failed to report incident" }, { status: 500 })
      return NextResponse.json({ incident }, { status: 201 })
    }

    const { incidentId } = body as { incidentId?: string }
    if (!incidentId) return NextResponse.json({ error: "incidentId is required" }, { status: 400 })

    let incident: Incident | null
    switch (action) {
      case "assign":
        incident = await assignIncident(organizationId, incidentId, user.id)
        break
      case "escalate":
        incident = await escalateIncident(organizationId, incidentId)
        break
      case "resolve":
        incident = await resolveIncident(organizationId, incidentId)
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
