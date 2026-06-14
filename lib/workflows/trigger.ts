import { start } from "workflow/api"
import { runWorkflow } from "./engine"
import { createExecution, updateExecution, type WorkflowRecord } from "./store"

/**
 * Module #6: Workflow trigger (Node context).
 *
 * Called from API routes — NOT from the workflow sandbox. Creates the
 * execution row, launches the durable workflow via `start()`, and records the
 * run id. Kept separate from engine.ts so the workflow bundle never imports
 * the store (which depends on cron-parser / node:crypto).
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

  const run = await start(runWorkflow, [
    {
      executionId: execution.id,
      organizationId: workflow.organization_id,
      workflowId: workflow.id,
      steps: workflow.steps,
      input,
    },
  ])

  // Record the run id (the workflow itself also flips status to "running").
  await updateExecution(execution.id, { run_id: run.runId })

  return { executionId: execution.id, runId: run.runId }
}
