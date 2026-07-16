import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { listDueScheduledWorkflows, advanceSchedule } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/trigger"

/** Scheduled: runs all due scheduled workflows. Auth: Authorization: Bearer CRON_SECRET. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const due = await listDueScheduledWorkflows()
  const results: Array<{ workflowId: string; executionId: string | null }> = []

  for (const workflow of due) {
    const run = await triggerWorkflow(workflow, "schedule", {}, null)
    await advanceSchedule(workflow)
    results.push({ workflowId: workflow.id, executionId: run?.executionId ?? null })
  }

  return NextResponse.json({ triggered: results.length, results })
}
