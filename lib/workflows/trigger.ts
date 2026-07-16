import { randomUUID } from "node:crypto"
import { runWorkflow } from "./engine"
import { createExecution, updateExecution, type WorkflowRecord } from "./store"

/**
 * Module #6: Workflow trigger (Node context).
 *
 * Called from API routes. Creates the execution row, then runs the workflow
 * in-process and awaits completion before returning — the caller (a cron
 * route or manual-trigger route) is expected to tolerate the step graph's
 * runtime (fast: DB writes, notifications, a single AI call, HTTP requests,
 * capped at 200 steps).
 */
export async function triggerWorkflow(
  workflow: WorkflowRecord,
  triggerType: string,
  input: Record<string, unknown>,
  startedBy: string | null,
): Promise<{ executionId: string; runId: string } | null> {
  const execution = await createExecution(
    workflow.organization_id,
    workflow.id,
    triggerType,
    input,
    startedBy,
  )
  if (!execution) return null

  const runId = randomUUID()
  await updateExecution(execution.id, { run_id: runId })

  await runWorkflow({
    executionId: execution.id,
    organizationId: workflow.organization_id,
    workflowId: workflow.id,
    steps: workflow.steps,
    input,
  })

  return { executionId: execution.id, runId }
}
