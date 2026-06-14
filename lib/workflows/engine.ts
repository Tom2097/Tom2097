import { executeStep, markRunning, finalizeExecution } from "./steps"
import type { StepContext, StepResult, WorkflowStep } from "./types"

/**
 * Module #6: Durable workflow engine.
 *
 * `runWorkflow` is a `"use workflow"` orchestrator: it walks the step graph
 * deterministically and delegates all I/O to durable `"use step"` functions
 * (in steps.ts) so the run is resumable and retryable.
 *
 * IMPORTANT: this module is bundled into the Workflow sandbox VM, so it may
 * only import other workflow/step modules (steps.ts, types.ts). It must NOT
 * import the store (cron-parser / node:crypto) or anything that pulls in
 * Node-only modules. Triggering from Node context lives in trigger.ts.
 *
 * Graph traversal:
 *  - linear steps advance via `next`, or fall through to the next step in
 *    definition order when `next` is omitted;
 *  - `condition` steps branch to `on_true` / `on_false` based on their output;
 *  - a failed step stops the run and marks the execution failed.
 */

const MAX_STEPS = 200

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
