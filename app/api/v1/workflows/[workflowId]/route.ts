import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/workflows/store"
import type { WorkflowStep, WorkflowTrigger } from "@/lib/workflows/types"

/** Extract the workflow id: /api/v1/workflows/{workflowId} */
function workflowIdFromPath(req: NextRequest): string {
  return req.nextUrl.pathname.split("/")[4] ?? ""
}

const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const workflow = await getWorkflow(organizationId, workflowIdFromPath(req))
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ workflow })
  },
  { requireAll: ["workflows:read"] },
)

const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = workflowIdFromPath(req)
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

    const existing = await getWorkflow(organizationId, id)
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await updateWorkflow(organizationId, id, body)
    if (!updated) return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 })

    // Distinguish enable/disable toggles for the audit trail.
    const action =
      body.enabled !== undefined && body.enabled !== existing.enabled
        ? body.enabled
          ? "workflow.enabled"
          : "workflow.disabled"
        : "workflow.updated"

    await logAuthEvent({
      action,
      userId,
      organizationId,
      resourceType: "workflow",
      resourceId: id,
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ workflow: updated })
  },
  { requireAll: ["workflows:write"] },
)

const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = workflowIdFromPath(req)
    const ok = await deleteWorkflow(organizationId, id)
    if (!ok) return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 })

    await logAuthEvent({
      action: "workflow.deleted",
      userId,
      organizationId,
      resourceType: "workflow",
      resourceId: id,
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ success: true })
  },
  { requireAll: ["workflows:delete"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
