import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/workflows/store"
import type { WorkflowStep, WorkflowTrigger, TriggerType, StepType } from "@/lib/workflows/types"

const TRIGGER_TYPES: TriggerType[] = ["manual", "event", "webhook", "schedule"]
const STEP_TYPES: StepType[] = [
  "create_task",
  "send_notification",
  "ai_generate",
  "search_index",
  "http_request",
  "condition",
]

function validateDefinition(body: { trigger?: WorkflowTrigger; steps?: WorkflowStep[] }): string | null {
  if (body.trigger) {
    if (!TRIGGER_TYPES.includes(body.trigger.type)) {
      return "trigger.type must be one of: " + TRIGGER_TYPES.join(", ")
    }
    if (body.trigger.type === "event" && !body.trigger.event) {
      return "event triggers require trigger.event"
    }
    if (body.trigger.type === "schedule" && !body.trigger.schedule_cron) {
      return "schedule triggers require trigger.schedule_cron"
    }
  }
  if (body.steps) {
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      return "steps must be a non-empty array"
    }
    const ids = new Set<string>()
    for (const step of body.steps) {
      if (!step.id || ids.has(step.id)) return "each step needs a unique id"
      ids.add(step.id)
      if (!STEP_TYPES.includes(step.type)) {
        return `invalid step type "${step.type}" (allowed: ${STEP_TYPES.join(", ")})`
      }
    }
  }
  return null
}

const get = withAuth(
  async (_req: NextRequest, { organizationId, params }) => {
    const workflow = await getWorkflow(organizationId, params.workflowId)
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ workflow })
  },
  { requireAll: ["workflows:read"] },
)

const update = withAuth(
  async (req: NextRequest, { organizationId, userId, params }) => {
    let body: {
      name?: string
      description?: string | null
      trigger?: WorkflowTrigger
      steps?: WorkflowStep[]
      enabled?: boolean
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const invalid = validateDefinition(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const workflow = await updateWorkflow(organizationId, params.workflowId, body)
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await logAuthEvent({
      action: "workflow.updated",
      userId,
      organizationId,
      resourceType: "workflow",
      resourceId: workflow.id,
      metadata: { name: workflow.name },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ workflow })
  },
  { requireAll: ["workflows:write"] },
)

const remove = withAuth(
  async (req: NextRequest, { organizationId, userId, params }) => {
    const ok = await deleteWorkflow(organizationId, params.workflowId)
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await logAuthEvent({
      action: "workflow.deleted",
      userId,
      organizationId,
      resourceType: "workflow",
      resourceId: params.workflowId,
      metadata: {},
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ success: true })
  },
  { requireAll: ["workflows:write"] },
)

export { get as GET, update as PUT, remove as DELETE }
