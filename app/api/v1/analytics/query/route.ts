import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { runQuery } from "@/lib/analytics/engine"
import { parseQuery } from "@/lib/analytics/query"

/**
 * POST /api/v1/analytics/query
 * Run an ad-hoc aggregate query (timeseries | breakdown | summary).
 * Org-scoped via withAuth; the validated organizationId is passed to the
 * SECURITY DEFINER engine functions.
 */
const query = withAuth(
  async (req: NextRequest, { organizationId }) => {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const [q, err] = parseQuery(body)
    if (err || !q) return NextResponse.json({ error: err }, { status: 400 })

    try {
      const result = await runQuery(organizationId, q)
      return NextResponse.json({ query: q, result })
    } catch (e) {
      const message = e instanceof Error ? e.message : "query failed"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["analytics:read"] },
)

export { query as POST }
