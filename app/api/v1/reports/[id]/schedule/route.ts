import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { getSchedule, isFrequency, upsertSchedule } from "@/lib/reporting/engine"
import type { ReportScheduleInput } from "@/lib/reporting/types"

/** Extract the report id that precedes /schedule. */
function reportIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("reports")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET /api/v1/reports/:id/schedule — current schedule. Requires reports:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = reportIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const schedule = await getSchedule(organizationId, id)
      return NextResponse.json({ schedule })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to load schedule"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:read"] },
)

/** PUT /api/v1/reports/:id/schedule — create/update schedule. Requires reports:write. */
const put = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = reportIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: ReportScheduleInput
    try {
      body = (await req.json()) as ReportScheduleInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!isFrequency(body.frequency)) {
      return NextResponse.json({ error: "frequency must be daily, weekly, or monthly" }, { status: 400 })
    }

    try {
      const schedule = await upsertSchedule(organizationId, id, body)
      if (!schedule) return NextResponse.json({ error: "report not found" }, { status: 404 })
      await logAuthEvent({
        action: "report.scheduled",
        userId,
        organizationId,
        resourceType: "report_definition",
        resourceId: id,
        metadata: { frequency: schedule.frequency, next_run_at: schedule.next_run_at, enabled: schedule.is_enabled },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ schedule })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to save schedule"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:write"] },
)

export { get as GET, put as PUT }
