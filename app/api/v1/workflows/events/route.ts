import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { listWorkflowsForEvent } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/trigger"

/**
 * Emit an in-app event: POST /api/v1/workflows/events { event, payload }
 *
 * Fires every enabled workflow in the caller's organization whose trigger is
 * an `event` trigger matching the given event name. Tenant-scoped via the
 * authenticated context.
 */
const emit = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: { event?: string; payload?: Record<string, unknown> }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body.event?.trim()) {
      return NextResponse.json({ error: "event is required" }, { status: 400 })
    }

    const workflows = await listWorkflowsForEvent(organizationId, body.event.trim())
    const input = body.payload ?? {}

    const fired: Array<{ workflowId: string; executionId: string; runId: string }> = []
    for (const workflow of workflows) {
      const result = await triggerWorkflow(workflow, "event", input, userId)
      if (result) {
        fired.push({ workflowId: workflow.id, executionId: result.executionId, runId: result.runId })
      }
    }

    if (fired.length > 0) {
      await logAuthEvent({
        action: "workflow.executed",
        userId,
        organizationId,
        resourceType: "workflow",
        metadata: { trigger: "event", event: body.event, count: fired.length },
        ipAddress: getClientIp(req.headers),
      })
    }

    return NextResponse.json({ matched: workflows.length, fired })
  },
  { requireAll: ["workflows:execute"] },
)

export { emit as POST }
