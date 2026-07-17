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
  const results: Array<{ workflowId: string; executionId: string | null; error?: string }> = []

  for (const workflow of due) {
    try {
      // Advance first so a failing/throwing workflow doesn't get stuck
      // re-triggering every tick -- a missed run is safer than a duplicate one.
      await advanceSchedule(workflow)
      const run = await triggerWorkflow(workflow, "schedule", {}, null)
      results.push({ workflowId: workflow.id, executionId: run?.executionId ?? null })
    } catch (err) {
      console.error(`[workflows] scheduled run failed for ${workflow.id}:`, err)
      results.push({
        workflowId: workflow.id,
        executionId: null,
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  return NextResponse.json({ triggered: results.length, results })
}
