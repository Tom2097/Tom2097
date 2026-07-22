import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getReports, createReport, normalizeReportConfig } from "@/lib/analytics/reports"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/reports
 *
 * List saved analytics reports for the caller's organization.
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : 0

    try {
      const { reports, total } = await getReports(context.organizationId, limit, offset)
      return NextResponse.json({ success: true, data: { reports, total } })
    } catch (error) {
      logger.logError("[API] Error listing analytics reports:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to list reports" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)

/**
 * POST /api/v1/analytics/reports
 *
 * Create a saved report from a query config.
 * Body: { name: string, description?: string, config: ReportConfig }
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 })
    }

    const [config, configError] = normalizeReportConfig(body.config)
    if (configError || !config) {
      return NextResponse.json({ success: false, error: configError ?? "invalid config" }, { status: 400 })
    }

    try {
      const report = await createReport(context.organizationId, context.userId, {
        name: body.name.trim(),
        description: typeof body.description === "string" ? body.description : null,
        config,
      })
      if (!report) {
        return NextResponse.json({ success: false, error: "Failed to create report" }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: report }, { status: 201 })
    } catch (error) {
      logger.logError("[API] Error creating analytics report:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to create report" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:write"] },
)
