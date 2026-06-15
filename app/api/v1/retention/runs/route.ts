import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { listRuns } from "@/lib/retention/engine"
import type { RetentionResourceType, RunStatus } from "@/lib/retention/types"

/**
 * GET /api/v1/retention/runs – list purge run history (filterable). retention:read
 */
async function getHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10)
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10)

  const { runs, total } = await listRuns(ctx.organizationId, {
    policyId: searchParams.get("policyId") ?? undefined,
    resourceType: (searchParams.get("resourceType") as RetentionResourceType | null) ?? undefined,
    status: (searchParams.get("status") as RunStatus | null) ?? undefined,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  })

  return NextResponse.json({ runs, total })
}

export const GET = withAuth(getHandler, { requireAll: ["retention:read"] })
