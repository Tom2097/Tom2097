import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { getWorkflow } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/engine"

/** Manually trigger a workflow: POST /api/v1/workflows/{workflowId}/execute */
const execute = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = req.nextUrl.pathname.split("/")[4] ?? ""

    const workflow = await getWorkflow(organizationId, id)
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!workflow.enabled) {
      return NextResponse.json({ error: "Workflow is disabled" }, { status: 409 })
    }

    let input: Record<string, unknown> = {}
    try {
      const body = await req.json()
      if (body && typeof body === "object") input = body.input ?? body
    } catch {
      // empty body is fine for manual triggers
    }

    const result = await triggerWorkflow(workflow, "manual", input, userId)
    if (!result) {
      return NextResponse.json({ error: "Failed to start execution" }, { status: 500 })
    }

    await logAuthEvent({
      action: "workflow.executed",
      userId,
      organizationId,
      resourceType: "workflow",
      resourceId: id,
      metadata: { trigger: "manual", executionId: result.executionId, runId: result.runId },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json(
      { executionId: result.executionId, runId: result.runId, status: "started" },
      { status: 202 },
    )
  },
  { requireAll: ["workflows:execute"] },
)

export { execute as POST }
