import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { runQuery } from "@/lib/analytics/engine"
import { parseQuery, toCsv } from "@/lib/analytics/query"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/export
 *
 * Run a query and return the result as a CSV download.
 * Same query params as GET /api/v1/analytics/query.
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url)
    const input = Object.fromEntries(searchParams.entries())

    const [query, error] = parseQuery(input)
    if (error || !query) {
      return NextResponse.json({ success: false, error: error ?? "invalid query" }, { status: 400 })
    }

    try {
      const result = await runQuery(context.organizationId, query)

      let rows: Record<string, unknown>[]
      if (result.type === "timeseries") {
        rows = result.points as unknown as Record<string, unknown>[]
      } else if (result.type === "breakdown") {
        rows = result.rows as unknown as Record<string, unknown>[]
      } else {
        rows = [result.summary as unknown as Record<string, unknown>]
      }

      const csv = toCsv(rows)

      await logAuthEvent({
        action: "analytics.exported",
        userId: context.userId,
        organizationId: context.organizationId,
        metadata: { type: query.type, event_name: query.event_name, start: query.start, end: query.end },
        ipAddress: getClientIp(request.headers),
      })

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-export-${query.type}-${Date.now()}.csv"`,
        },
      })
    } catch (e) {
      logger.logError("[API] Error exporting analytics query:", e instanceof Error ? { message: e.message } : { error: String(e) })
      return NextResponse.json({ success: false, error: "Failed to export query" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:export"] },
)
