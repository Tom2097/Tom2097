import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { getAuditLogStats } from "@/lib/audit/store"

/**
 * GET /api/v1/audit/stats
 * Returns aggregated statistics via get_audit_log_stats() SECURITY DEFINER.
 * Requires audit:read.
 *
 * Query params:
 *   days  (default 30, max 365)
 */
async function handler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("days") ?? "30"), 1), 365)

  try {
    const stats = await getAuditLogStats(ctx.organizationId, days)
    return NextResponse.json(stats)
  } catch (err) {
    console.log("[v0] audit stats error:", err)
    return NextResponse.json({ error: "Failed to fetch audit stats" }, { status: 500 })
  }
}

export const GET = withAuth(handler, { requireAll: ["audit:read"] })
