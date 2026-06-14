import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import {
  deleteReport,
  getReport,
  normalizeReportConfig,
  updateReport,
} from "@/lib/analytics/reports"
import type { ReportConfig } from "@/lib/analytics/types"

/**
 * GET    /api/v1/analytics/reports/:id  — read a saved report (analytics:read)
 * PATCH  /api/v1/analytics/reports/:id  — update name/description/config (analytics:write)
 * DELETE /api/v1/analytics/reports/:id  — delete a report (analytics:write)
 * The report id is matched together with the caller's organizationId so cross
 * tenant access is impossible.
 */
function reportIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/")
  return parts[parts.length - 1]
}

const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const report = await getReport(organizationId, reportIdFromPath(req))
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })
    return NextResponse.json({ report })
  },
  { requireAll: ["analytics:read"] },
)

const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = reportIdFromPath(req)
    let body: { name?: string; description?: string | null; config?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const patch: { name?: string; description?: string | null; config?: ReportConfig } = {}
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
      patch.name = body.name.trim()
    }
    if (body.description !== undefined) patch.description = body.description
    if (body.config !== undefined) {
      const [config, err] = normalizeReportConfig(body.config)
      if (err || !config) return NextResponse.json({ error: err }, { status: 400 })
      patch.config = config
    }

    const report = await updateReport(organizationId, id, patch)
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    await logAuthEvent({
      action: "analytics.report_updated",
      userId,
      organizationId,
      resourceType: "analytics_report",
      resourceId: id,
      metadata: { fields: Object.keys(patch) },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ report })
  },
  { requireAll: ["analytics:write"] },
)

const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = reportIdFromPath(req)
    const existing = await getReport(organizationId, id)
    if (!existing) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    const ok = await deleteReport(organizationId, id)
    if (!ok) return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })

    await logAuthEvent({
      action: "analytics.report_deleted",
      userId,
      organizationId,
      resourceType: "analytics_report",
      resourceId: id,
      metadata: { name: existing.name },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ deleted: true })
  },
  { requireAll: ["analytics:write"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
