import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getExecution } from "@/lib/workflows/store"

/** Single execution: GET /api/v1/workflows/{workflowId}/executions/{executionId} */
const get = withAuth(
  async (_req: NextRequest, { organizationId, params }) => {
    const { workflowId, executionId } = params
    const execution = await getExecution(organizationId, executionId, workflowId)
    if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ execution })
  },
  { requireAll: ["workflows:read"] },
)

export { get as GET }
