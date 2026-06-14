import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { exportAuditLogs } from "@/lib/audit/store"
import { logAuthEvent } from "@/lib/auth/audit"
import type { AuditLogFilters } from "@/lib/audit/types"

/**
 * GET /api/v1/audit/export
 * Exports audit log data as CSV (max 10 000 rows).
 * Requires audit:export.
 *
 * Query params: same filters as /api/v1/audit
 */
async function handler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const p = req.nextUrl.searchParams

  const filters: AuditLogFilters = {}
  const action = p.get("action")
  const userId = p.get("userId")
  const resourceType = p.get("resourceType")
  const since = p.get("since")
  const until = p.get("until")

  if (action) filters.action = action
  if (userId) filters.userId = userId
  if (resourceType) filters.resourceType = resourceType
  if (since) filters.since = since
  if (until) filters.until = until

  try {
    const csv = await exportAuditLogs(ctx.organizationId, filters)

    await logAuthEvent({
      action: "audit.exported",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      resourceType: "audit_logs",
      metadata: { filters },
    })

    const filename = `audit-log-${ctx.organizationId}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.log("[v0] audit export error:", err)
    return NextResponse.json({ error: "Failed to export audit logs" }, { status: 500 })
  }
}

export const GET = withAuth(handler, { requireAll: ["audit:export"] })
