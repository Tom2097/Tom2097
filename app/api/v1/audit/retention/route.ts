import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { runRetentionCleanup } from "@/lib/audit/store"
import { logAuthEvent } from "@/lib/auth/audit"

/**
 * GET  /api/v1/audit/retention  – return current retention settings (no-op: returns 365-day default)
 * POST /api/v1/audit/retention  – run retention cleanup for the org
 * Requires audit:manage.
 */

const DEFAULT_RETENTION_DAYS = 365
const MIN_RETENTION_DAYS = 30
const MAX_RETENTION_DAYS = 3650

async function getHandler(_req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  return NextResponse.json({
    retentionDays: DEFAULT_RETENTION_DAYS,
    organizationId: ctx.organizationId,
    note: "Retention policy is enforced on-demand via POST. Default: 365 days.",
  })
}

async function postHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  let retentionDays = DEFAULT_RETENTION_DAYS

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.retentionDays === "number") {
      retentionDays = Math.min(
        Math.max(body.retentionDays, MIN_RETENTION_DAYS),
        MAX_RETENTION_DAYS
      )
    }
  } catch {
    // use default
  }

  try {
    const deleted = await runRetentionCleanup(ctx.organizationId, retentionDays, ctx.userId)

    await logAuthEvent({
      action: "audit.retention_updated",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      resourceType: "audit_logs",
      metadata: { retention_days: retentionDays, deleted_count: deleted },
    })

    return NextResponse.json({ success: true, retentionDays, deletedCount: deleted })
  } catch (err) {
    console.log("[v0] audit retention error:", err)
    return NextResponse.json({ error: "Failed to run retention cleanup" }, { status: 500 })
  }
}

export const GET = withAuth(getHandler, { requireAll: ["audit:manage"] })
export const POST = withAuth(postHandler, { requireAll: ["audit:manage"] })
