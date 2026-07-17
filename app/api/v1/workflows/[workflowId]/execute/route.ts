import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { getWorkflow } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/trigger"

/** POST /api/v1/workflows/[workflowId]/execute — manually run a workflow now. */
const post = withAuth(
  async (req: NextRequest, { organizationId, userId, params }) => {
    const workflow = await getWorkflow(organizationId, params.workflowId)
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let input: Record<string, unknown> = {}
    try {
      const body = await req.json()
      if (body && typeof body === "object") input = body
    } catch {
      // no body is fine — manual runs may not need input
    }

    let run
    try {
      run = await triggerWorkflow(workflow, "manual", input, userId)
    } catch (err) {
      console.error(`[workflows] manual execute failed for ${workflow.id}:`, err)
      return NextResponse.json({ error: "Execution failed" }, { status: 500 })
    }
    if (!run) return NextResponse.json({ error: "Failed to start execution" }, { status: 500 })

    await logAuthEvent({
      action: "workflow.executed",
      userId,
      organizationId,
      resourceType: "workflow",
      resourceId: workflow.id,
      metadata: { trigger: "manual", execution_id: run.executionId },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json(run)
  },
  { requireAll: ["workflows:write"] },
)

export { post as POST }
