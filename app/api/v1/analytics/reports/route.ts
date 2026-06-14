import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { createReport, listReports, normalizeReportConfig } from "@/lib/analytics/reports"

/**
 * GET  /api/v1/analytics/reports  — list saved reports (analytics:read)
 * POST /api/v1/analytics/reports  — create a saved report (analytics:write)
 * Both are org-scoped via withAuth.
 */
const list = withAuth(
  async (_req: NextRequest, { organizationId }) => {
    const reports = await listReports(organizationId)
    return NextResponse.json({ reports })
  },
  { requireAll: ["analytics:read"] },
)

const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: { name?: string; description?: string | null; config?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    const [config, err] = normalizeReportConfig(body.config)
    if (err || !config) return NextResponse.json({ error: err }, { status: 400 })

    const report = await createReport(organizationId, userId, {
      name: body.name.trim(),
      description: body.description ?? null,
      config,
    })
    if (!report) {
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 })
    }

    await logAuthEvent({
      action: "analytics.report_created",
      userId,
      organizationId,
      resourceType: "analytics_report",
      resourceId: report.id,
      metadata: { name: report.name, type: report.config.type },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ report }, { status: 201 })
  },
  { requireAll: ["analytics:write"] },
)

export { list as GET, create as POST }
