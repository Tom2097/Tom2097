import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getExecution } from "@/lib/workflows/store"

/** Single execution: GET /api/v1/workflows/{workflowId}/executions/{executionId} */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const segments = req.nextUrl.pathname.split("/")
    const executionId = segments[6] ?? ""
    const execution = await getExecution(organizationId, executionId)
    if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ execution })
  },
  { requireAll: ["workflows:read"] },
)

export { get as GET }
