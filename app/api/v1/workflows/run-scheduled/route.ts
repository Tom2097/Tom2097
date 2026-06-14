import { type NextRequest, NextResponse } from "next/server"
import { listDueScheduledWorkflows, advanceSchedule } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/trigger"

/**
 * Scheduled-trigger runner: POST (or GET) /api/v1/workflows/run-scheduled
 *
 * Designed to be invoked by an external scheduler (e.g. Vercel Cron). It is a
 * system endpoint that spans organizations, so it is NOT behind withAuth.
 * Instead it requires the CRON_SECRET bearer token. Each due workflow is fired
 * (tenant scoping comes from the workflow's own organization_id) and its
 * next_run_at is advanced from the cron expression.
 */
async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 },
    )
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const due = await listDueScheduledWorkflows(now)

  const fired: Array<{ workflowId: string; executionId: string; runId: string }> = []
  for (const workflow of due) {
    const result = await triggerWorkflow(workflow, "schedule", {}, null)
    // Advance the schedule regardless so a transient start failure doesn't
    // cause the workflow to fire repeatedly on every tick.
    await advanceSchedule(workflow, now)
    if (result) {
      fired.push({ workflowId: workflow.id, executionId: result.executionId, runId: result.runId })
    }
  }

  return NextResponse.json({ checked: due.length, fired })
}

export { handler as POST, handler as GET }
