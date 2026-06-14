import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteDefinition, getDefinition, getSchedule, updateDefinition } from "@/lib/reporting/engine"
import type { ReportDefinitionInput } from "@/lib/reporting/types"

/** Extract the report id from /api/v1/reports/:id[/...]. */
export function reportIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("reports")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET /api/v1/reports/:id — definition + its schedule. Requires reports:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = reportIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const report = await getDefinition(organizationId, id)
      if (!report) return NextResponse.json({ error: "not found" }, { status: 404 })
      const schedule = await getSchedule(organizationId, id)
      return NextResponse.json({ report, schedule })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch report"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:read"] },
)

/** PATCH /api/v1/reports/:id — edit definition. Requires reports:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = reportIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: Partial<ReportDefinitionInput>
    try {
      body = (await req.json()) as Partial<ReportDefinitionInput>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
      const updated = await updateDefinition(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "report.updated",
        userId,
        organizationId,
        resourceType: "report_definition",
        resourceId: id,
        metadata: { fields: Object.keys(body) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ report: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update report"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:write"] },
)

/** DELETE /api/v1/reports/:id — remove definition (cascades schedule+runs). Requires reports:write. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = reportIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteDefinition(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "report.deleted",
        userId,
        organizationId,
        resourceType: "report_definition",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete report"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:write"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
