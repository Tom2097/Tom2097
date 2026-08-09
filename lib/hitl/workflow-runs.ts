import { createServiceClient } from "@/lib/supabase/service"
import { raiseHAR, type RaiseHarInput } from "./har"
import type { WorkflowRun } from "./types"

/**
 * Starts a durable, pausable workflow run. This is a distinct concept from
 * lib/workflows/*'s workflow_executions (see the migration header) -- this
 * is for any multi-step process that may need to stop for a human, not the
 * fixed trigger->action automation engine.
 */
export async function startWorkflowRun(
  organizationId: string,
  workflowType: string,
  context: Record<string, unknown> = {},
  triggeredBy?: string | null,
): Promise<WorkflowRun | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflow_runs")
    .insert({ organization_id: organizationId, workflow_type: workflowType, context, triggered_by: triggeredBy ?? null })
    .select("*")
    .single()
  if (error) {
    console.error("[hitl] startWorkflowRun failed:", error.message)
    return null
  }
  return data as WorkflowRun
}

/**
 * The "dependency check fails" path (spec Figure 1): a step can't
 * continue, so the run pauses and a HAR is raised. Never blocks a worker
 * (spec section 2) -- this returns as soon as the HAR is inserted; nothing
 * here waits for the human to act. Resuming actual downstream work is the
 * caller's responsibility once human.action.completed fires for this run
 * (Tier 2: wiring a real workflow_type's continuation is a separate,
 * per-workflow decision the founder's Tier 1 answers unblock -- Tier 0
 * only builds the durable pause/resume mechanism itself, not any specific
 * business process using it).
 */
export async function pauseForHuman(
  harInput: Omit<RaiseHarInput, "workflowRunId"> & { workflowRunId: string },
) {
  return raiseHAR(harInput)
}

export async function getWorkflowRun(organizationId: string, runId: string): Promise<WorkflowRun | null> {
  const db = createServiceClient()
  const { data } = await db
    .from("workflow_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .maybeSingle()
  return data as WorkflowRun | null
}
