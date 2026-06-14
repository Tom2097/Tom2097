import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { listExecutions } from "@/lib/workflows/store"

/** Execution history for a workflow: GET /api/v1/workflows/{workflowId}/executions */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const workflowId = req.nextUrl.pathname.split("/")[4] ?? ""
    const executions = await listExecutions(organizationId, workflowId)
    return NextResponse.json({ executions })
  },
  { requireAll: ["workflows:read"] },
)

export { list as GET }
