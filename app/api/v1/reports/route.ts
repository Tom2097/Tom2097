import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createDefinition, listDefinitions, validateDefinition } from "@/lib/reporting/engine"
import type { ReportDefinitionInput } from "@/lib/reporting/types"

/**
 * GET /api/v1/reports — list report definitions for the caller's org.
 * Requires reports:read.  Query: ?limit=&offset=&active=true
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 200)
    const offset = Math.max(Number(sp.get("offset") ?? 0), 0)
    try {
      const result = await listDefinitions(organizationId, {
        limit,
        offset,
        activeOnly: sp.get("active") === "true",
      })
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list reports"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:read"] },
)

/**
 * POST /api/v1/reports — create a report definition. Requires reports:write.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const invalid = validateDefinition(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const created = await createDefinition(organizationId, userId, body as unknown as ReportDefinitionInput)
      await logAuthEvent({
        action: "report.created",
        userId,
        organizationId,
        resourceType: "report_definition",
        resourceId: created.id,
        metadata: { name: created.name, sections: created.sections.length },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ report: created }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create report"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["reports:write"] },
)

export { list as GET, create as POST }
