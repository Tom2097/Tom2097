import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { runQuery } from "@/lib/analytics/engine"
import { getReport, reportToQuery } from "@/lib/analytics/reports"

/**
 * GET /api/v1/analytics/reports/:id/run
 * Execute a saved report against its rolling window and return the result.
 * Org-scoped: the report is fetched by id + organizationId first.
 */
const run = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const parts = req.nextUrl.pathname.split("/")
    const id = parts[parts.length - 2] // .../reports/:id/run
    const report = await getReport(organizationId, id)
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    const query = reportToQuery(report.config)
    try {
      const result = await runQuery(organizationId, query)
      return NextResponse.json({ report: { id: report.id, name: report.name }, query, result })
    } catch (e) {
      const message = e instanceof Error ? e.message : "report run failed"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["analytics:read"] },
)

export { run as GET }
