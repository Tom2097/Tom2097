import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { runQuery } from "@/lib/analytics/engine"
import { parseQuery, toCsv } from "@/lib/analytics/query"

/**
 * POST /api/v1/analytics/export
 * Run a query and stream the result back as CSV. Requires analytics:export.
 * Org-scoped via withAuth; export actions are audited.
 */
const exportCsv = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const [q, err] = parseQuery(body)
    if (err || !q) return NextResponse.json({ error: err }, { status: 400 })

    let csv: string
    try {
      const result = await runQuery(organizationId, q)
      if (result.type === "timeseries") {
        csv = toCsv(result.points as unknown as Record<string, unknown>[], ["bucket", "value"])
      } else if (result.type === "breakdown") {
        csv = toCsv(result.rows as unknown as Record<string, unknown>[], ["label", "value"])
      } else {
        csv = toCsv([result.summary as unknown as Record<string, unknown>], [
          "total_events",
          "unique_users",
          "distinct_events",
          "total_value",
        ])
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "export failed"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    await logAuthEvent({
      action: "analytics.exported",
      userId,
      organizationId,
      resourceType: "analytics",
      metadata: { type: q.type, start: q.start, end: q.end },
      ipAddress: getClientIp(req.headers),
    })

    const filename = `analytics-${q.type}-${Date.now()}.csv`
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  },
  { requireAll: ["analytics:export"] },
)

export { exportCsv as POST }
