import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { listWorkflows, createWorkflow } from "@/lib/workflows/store"
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

function validateDefinition(body: {
  trigger?: WorkflowTrigger
  steps?: WorkflowStep[]
}): string | null {
  const trigger = body.trigger
  if (!trigger || !TRIGGER_TYPES.includes(trigger.type)) {
    return "trigger.type must be one of: " + TRIGGER_TYPES.join(", ")
  }
  if (trigger.type === "event" && !trigger.event) {
    return "event triggers require trigger.event"
  }
  if (trigger.type === "schedule" && !trigger.schedule_cron) {
    return "schedule triggers require trigger.schedule_cron"
  }
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
  return null
}

const list = withAuth(
  async (_req: NextRequest, { organizationId }) => {
    const workflows = await listWorkflows(organizationId)
    return NextResponse.json({ workflows })
  },
  { requireAll: ["workflows:read"] },
)

const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
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

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    const invalid = validateDefinition(body)
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 })
    }

    const workflow = await createWorkflow(organizationId, userId, {
      name: body.name.trim(),
      description: body.description ?? null,
      trigger: body.trigger!,
      steps: body.steps!,
      enabled: body.enabled,
    })

    if (!workflow) {
      return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 })
    }

    await logAuthEvent({
      action: "workflow.created",
      userId,
      organizationId,
      resourceType: "workflow",
      resourceId: workflow.id,
      metadata: { name: workflow.name, trigger: workflow.trigger.type },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ workflow }, { status: 201 })
  },
  { requireAll: ["workflows:write"] },
)

export { list as GET, create as POST }
