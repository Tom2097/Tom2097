import { start } from "workflow/api"
import { executeStep } from "./steps"
import { updateExecution, createExecution, type WorkflowRecord } from "./store"
import type { StepContext, StepResult, WorkflowStep } from "./types"

/**
 * Module #6: Durable workflow engine.
 *
 * `runWorkflow` is a `"use workflow"` orchestrator: it walks the step graph
 * deterministically and delegates all I/O to durable `"use step"` functions
 * (in steps.ts) so the run is resumable and retryable. Persistence of run
 * status happens through the step helpers below.
 *
 * Graph traversal:
 *  - linear steps advance via `next`, or fall through to the next step in
 *    definition order when `next` is omitted;
 *  - `condition` steps branch to `on_true` / `on_false` based on their output;
 *  - a failed step stops the run and marks the execution failed.
 */

const MAX_STEPS = 200

async function markRunning(executionId: string) {
  "use step"
  await updateExecution(executionId, { status: "running" })
}

async function finalizeExecution(
  executionId: string,
  status: "completed" | "failed",
  stepResults: StepResult[],
  error: string | null,
) {
  "use step"
  await updateExecution(executionId, {
    status,
    step_results: stepResults,
    error,
    completed_at: new Date().toISOString(),
  })
}

export interface RunWorkflowParams {
  executionId: string
  organizationId: string
  workflowId: string
  steps: WorkflowStep[]
  input: Record<string, unknown>
}

export async function runWorkflow(params: RunWorkflowParams) {
  "use workflow"
  const { executionId, organizationId, workflowId, steps, input } = params

  await markRunning(executionId)

  const byId: Record<string, WorkflowStep> = {}
  steps.forEach((s) => (byId[s.id] = s))
  const orderIndex: Record<string, number> = {}
  steps.forEach((s, i) => (orderIndex[s.id] = i))

  const stepOutputs: Record<string, unknown> = {}
  const results: StepResult[] = []

  let currentId: string | null | undefined = steps[0]?.id
  let guard = 0

  while (currentId && guard < MAX_STEPS) {
    guard++
    const step: WorkflowStep | undefined = byId[currentId]
    if (!step) break

    const context: StepContext = { organizationId, executionId, workflowId, input, steps: stepOutputs }
    const result = await executeStep(step, context)
    results.push(result)

    if (result.status === "failed") {
      await finalizeExecution(executionId, "failed", results, result.error ?? "Step failed")
      return { status: "failed" as const, results }
    }

    if (step.type === "condition") {
      const matched = Boolean((result.output as { matched?: boolean })?.matched)
      currentId = matched ? step.on_true : step.on_false
    } else {
      stepOutputs[step.id] = result.output
      // explicit next, else fall through to next step in definition order
      currentId = step.next !== undefined ? step.next : steps[orderIndex[step.id] + 1]?.id ?? null
    }
  }

  await finalizeExecution(executionId, "completed", results, null)
  return { status: "completed" as const, results }
}

/**
 * Trigger a workflow run. Called from API routes (Node context): creates the
 * execution row, launches the durable workflow, and records the run id.
 * Returns the execution id and run id, or null if the execution couldn't be created.
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

  // Record the run id now that we have it (the workflow also sets it via markRunning).
  await updateExecution(execution.id, { run_id: run.runId })

  return { executionId: execution.id, runId: run.runId }
}
