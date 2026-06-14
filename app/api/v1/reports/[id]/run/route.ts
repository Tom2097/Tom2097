import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { generateRun } from "@/lib/reporting/engine"

/** Extract the report id that precedes /run. */
function reportIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("reports")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * POST /api/v1/reports/:id/run — generate a report run on demand.
 * Requires reports:run.
 */
const run = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = reportIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const result = await generateRun(organizationId, id, userId, "manual")
      if (!result) return NextResponse.json({ error: "report not found" }, { status: 404 })
      await logAuthEvent({
        action: "report.generated",
        userId,
        organizationId,
        resourceType: "report_run",
        resourceId: result.id,
        metadata: { definition_id: id, status: result.status, trigger: "manual" },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ run: result }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to generate report"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:run"] },
)

export { run as POST }
