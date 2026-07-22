import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { runQuery } from "@/lib/analytics/engine"
import { parseQuery } from "@/lib/analytics/query"
import { logger } from "@/lib/logging"

/**
 * POST /api/v1/analytics/query
 *
 * Run a timeseries/breakdown/summary query against the analytics engine.
 * Body: { type, event_name?, event_category?, aggregate?, granularity?,
 *          dimension?, start?, end?, range_days?, limit? }
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const [query, error] = parseQuery(body)
    if (error || !query) {
      return NextResponse.json({ success: false, error: error ?? "invalid query" }, { status: 400 })
    }

    try {
      const result = await runQuery(context.organizationId, query)
      return NextResponse.json({ success: true, data: { query, result } })
    } catch (e) {
      logger.logError("[API] Error running analytics query:", e instanceof Error ? { message: e.message } : { error: String(e) })
      return NextResponse.json({ success: false, error: "Failed to run query" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)

/**
 * GET /api/v1/analytics/query
 *
 * Same as POST, but reads the query definition from search params for
 * simple/link-friendly usage.
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
      return NextResponse.json({ success: true, data: { query, result } })
    } catch (e) {
      logger.logError("[API] Error running analytics query:", e instanceof Error ? { message: e.message } : { error: String(e) })
      return NextResponse.json({ success: false, error: "Failed to run query" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
