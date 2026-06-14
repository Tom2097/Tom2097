import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { listRuns } from "@/lib/reporting/engine"

/** Extract the report id that precedes /runs. */
function reportIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("reports")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * GET /api/v1/reports/:id/runs — run history for a definition.
 * Requires reports:read.  Query: ?limit=&offset=
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = reportIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    const sp = req.nextUrl.searchParams
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? 25), 1), 100)
    const offset = Math.max(Number(sp.get("offset") ?? 0), 0)
    try {
      const result = await listRuns(organizationId, id, { limit, offset })
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list runs"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:read"] },
)

export { list as GET }
