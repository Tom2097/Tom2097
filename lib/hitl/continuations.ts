import { createServiceClient } from "@/lib/supabase/service"
import { registerJobHandler } from "@/lib/jobs/handlers"
import type { HumanActionRequest, WorkflowRun } from "./types"

/**
 * Tier 2: actually resuming a real business workflow after a human acts on
 * its HAR. Tier 0 built the pause/resume mechanism (workflow_runs flips to
 * "resumed", human.action.completed fires) but deliberately left "what
 * happens next" unimplemented -- that's a per-workflow_type decision, and
 * this is where each real gate registers what its own resume means.
 *
 * Wired as a background job (human.action.completed -> hitl.resume_workflow
 * in event_job_subscriptions, same event->job dispatch pattern as every
 * other cross-module reaction on the bus) rather than called synchronously
 * from actOnHAR, so a slow or failing continuation (e.g. a downstream
 * insert) can't block the person's approval action or leave a HAR stuck in
 * a half-acted state -- the HAR itself is already fully resolved and
 * audited by the time this runs.
 */
export type ContinuationHandler = (
  run: WorkflowRun,
  har: HumanActionRequest,
) => Promise<void>

const registry = new Map<string, ContinuationHandler>()

/** Each gate (lib/compliance/capa.ts, lib/compliance/esignatures.ts, ...)
 *  calls this once at module load to register what "approved" / "rejected"
 *  means for its own workflow_type. */
export function registerContinuation(workflowType: string, handler: ContinuationHandler): void {
  registry.set(workflowType, handler)
}

registerJobHandler("hitl.resume_workflow", async (organizationId, payload) => {
  const workflowRunId = payload.workflow_run_id as string | null
  const harId = payload.har_id as string | undefined
  if (!workflowRunId || !harId) return // HAR wasn't tied to a workflow run -- nothing to continue

  const db = createServiceClient()
  const { data: run } = await db
    .from("workflow_runs")
    .select("*")
    .eq("id", workflowRunId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (!run) return

  const handler = registry.get(run.workflow_type)
  if (!handler) {
    console.warn(`[hitl] no continuation registered for workflow_type "${run.workflow_type}"`)
    return
  }

  const { data: har } = await db
    .from("human_action_requests")
    .select("*")
    .eq("id", harId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (!har) return

  await handler(run as WorkflowRun, har as HumanActionRequest)

  await db
    .from("workflow_runs")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", run.id)
})
