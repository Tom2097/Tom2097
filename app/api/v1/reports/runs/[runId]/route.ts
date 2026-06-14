import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getRun } from "@/lib/reporting/engine"

/** Extract the run id from /api/v1/reports/runs/:runId. */
function runIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("runs")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * GET /api/v1/reports/runs/:runId — fetch a single generated run snapshot.
 * Requires reports:read.
 */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const runId = runIdFromUrl(req)
    if (!runId) return NextResponse.json({ error: "missing run id" }, { status: 400 })
    try {
      const run = await getRun(organizationId, runId)
      if (!run) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ run })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch run"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:read"] },
)

export { get as GET }
