import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { listAuditLogs } from "@/lib/audit/store"
import type { AuditLogFilters } from "@/lib/audit/types"

/**
 * GET /api/v1/audit
 * List org-scoped audit log entries with filters and pagination.
 * Requires audit:read.
 *
 * Query params:
 *   limit   (default 50, max 500)
 *   offset  (default 0)
 *   action
 *   userId
 *   resourceType
 *   resourceId
 *   since   ISO datetime
 *   until   ISO datetime
 */
async function handler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const p = req.nextUrl.searchParams

  const limit = Math.min(Math.max(parseInt(p.get("limit") ?? "50"), 1), 500)
  const offset = Math.max(parseInt(p.get("offset") ?? "0"), 0)

  const filters: AuditLogFilters = {}
  const action = p.get("action")
  const userId = p.get("userId")
  const resourceType = p.get("resourceType")
  const resourceId = p.get("resourceId")
  const since = p.get("since")
  const until = p.get("until")

  if (action) filters.action = action
  if (userId) filters.userId = userId
  if (resourceType) filters.resourceType = resourceType
  if (resourceId) filters.resourceId = resourceId
  if (since) filters.since = since
  if (until) filters.until = until

  try {
    const result = await listAuditLogs(ctx.organizationId, filters, limit, offset)
    return NextResponse.json(result)
  } catch (err) {
    console.log("[v0] audit list error:", err)
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
  }
}

export const GET = withAuth(handler, { requireAll: ["audit:read"] })
