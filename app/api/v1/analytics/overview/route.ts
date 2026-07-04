import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { queryBreakdown, queryTimeseries, querySummary } from "@/lib/analytics/engine"

/**
 * GET /api/v1/analytics/overview?days=30&granularity=day
 * A ready-made dashboard payload: headline summary, an event-volume timeseries,
 * and top events / categories breakdowns over a rolling window. Org-scoped.
 */
const overview = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const days = Math.min(Math.max(Number(sp.get("days")) || 30, 1), 365)
    const granularity = (sp.get("granularity") as "hour" | "day" | "week" | "month") ?? "day"

    const end = new Date()
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [summary, timeseries, topEvents, topCategories] = await Promise.all([
      querySummary(organizationId, startIso, endIso),
    queryTimeseries(organizationId, {
      type: "timeseries",
      event_name: "session_start",
      event_category: "user",
      start: startIso,
      end: endIso,
      granularity,
      aggregate: "count",
      limit: 1000,
    }),
    queryBreakdown(organizationId, {
      type: "breakdown",
      event_name: "session_start",
      event_category: "user",
      dimension: "event_name",
      start: startIso,
      end: endIso,
      aggregate: "count",
      limit: 10,
      granularity: "day",
    }),
    queryBreakdown(organizationId, {
      type: "breakdown",
      event_name: "session_start",
      event_category: "user",
      dimension: "event_category",
      start: startIso,
      end: endIso,
      aggregate: "count",
      limit: 10,
      granularity: "day",
    }),
    ])

    return NextResponse.json({
      range: { start: startIso, end: endIso, days, granularity },
      summary,
      timeseries,
      topEvents,
      topCategories,
    })
  },
  { requireAll: ["analytics:read"] },
)

export { overview as GET }
