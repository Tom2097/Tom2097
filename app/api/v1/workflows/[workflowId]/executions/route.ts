import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { listExecutions } from "@/lib/workflows/store"

/** GET /api/v1/workflows/[workflowId]/executions — recent runs for this workflow. */
const get = withAuth(
  async (req: NextRequest, { organizationId, params }) => {
    const limitParam = req.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 50, 1), 200) : 50
    const executions = await listExecutions(organizationId, params.workflowId, limit)
    return NextResponse.json({ executions })
  },
  { requireAll: ["workflows:read"] },
)

export { get as GET }
