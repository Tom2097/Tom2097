"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { listWorkflows } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/trigger"

export async function GET() {
  return NextResponse.json({ message: 'Test' })
}

/**
 * POST /api/v1/intelligence/orchestrate - "Run Orchestration" command from
 * the floating command bar. There's no separate orchestration engine in
 * this codebase -- the real primitive for "run a multi-step action
 * sequence" is the workflow engine (Module #6), so this matches the
 * requested `intent` (a free-text label, e.g. "prepare_for_audit") against
 * this org's enabled manual-trigger workflows by name and, on a match,
 * actually runs it via the same triggerWorkflow() used by the manual
 * "execute workflow" endpoint. If nothing matches, this says so honestly
 * instead of pretending an orchestration ran.
 */
const post = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  let intent = ""
  try {
    const body = await req.json()
    intent = typeof body?.intent === "string" ? body.intent : ""
  } catch {
    // no/invalid body
  }
  if (!intent.trim()) {
    return NextResponse.json({ error: "intent is required" }, { status: 400 })
  }

  const normalizedIntent = intent.trim().toLowerCase().replace(/[_-]+/g, " ")

  const workflows = await listWorkflows(organizationId)
  const match = workflows.find((w) => {
    if (!w.enabled) return false
    const normalizedName = w.name.trim().toLowerCase().replace(/[_-]+/g, " ")
    return normalizedName === normalizedIntent || normalizedName.includes(normalizedIntent) || normalizedIntent.includes(normalizedName)
  })

  if (!match) {
    return NextResponse.json({
      matched: false,
      intent,
      message: `No enabled workflow matches intent "${intent}". Create a workflow with a matching name to wire this up.`,
    })
  }

  let run
  try {
    run = await triggerWorkflow(match, "manual", { intent }, userId)
  } catch (err) {
    console.error(`[intelligence/orchestrate] execution failed for ${match.id}:`, err)
    return NextResponse.json({ error: "Orchestration failed" }, { status: 500 })
  }
  if (!run) {
    return NextResponse.json({ error: "Failed to start orchestration" }, { status: 500 })
  }

  await logAuthEvent({
    action: "workflow.executed",
    userId,
    organizationId,
    resourceType: "workflow",
    resourceId: match.id,
    metadata: { trigger: "orchestrate", intent, execution_id: run.executionId },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({
    matched: true,
    intent,
    workflow: { id: match.id, name: match.name },
    executionId: run.executionId,
    runId: run.runId,
  })
})

export { post as POST }
