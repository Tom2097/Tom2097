import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { logAuthEvent } from "@/lib/auth/audit"
import { runPolicyById } from "@/lib/retention/engine"

/**
 * POST /api/v1/retention/policies/[id]/run – manually trigger this policy's
 * purge now. retention:write.
 */
async function postHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  // Path: /api/v1/retention/policies/[id]/run → id is the second-to-last segment.
  const segments = req.nextUrl.pathname.split("/")
  const id = segments[segments.length - 2]

  const result = await runPolicyById(ctx.organizationId, id, ctx.userId)
  if (!result) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

  await logAuthEvent({
    action: result.status === "failed" ? "retention.purge_failed" : "retention.purge_run",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "retention_policy",
    resourceId: result.policyId,
    metadata: {
      resource_type: result.resourceType,
      status: result.status,
      deleted_count: result.deletedCount,
      trigger: "manual",
      error: result.error ?? null,
    },
  })

  const httpStatus = result.status === "failed" ? 500 : 200
  return NextResponse.json({ result }, { status: httpStatus })
}

export const POST = withAuth(postHandler, { requireAll: ["retention:write"] })
