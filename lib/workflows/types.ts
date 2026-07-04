/**
 * Module #6: Workflow Automation Engine — shared types.
 *
 * A workflow is a tenant-scoped definition with a trigger and an ordered set
 * of steps. Steps form a simple graph: linear `next` pointers, plus
 * `on_true`/`on_false` branches for `condition` steps. The durable engine
 * (engine.ts) walks this graph; individual actions live in steps.ts.
 */

export type TriggerType = "manual" | "event" | "webhook" | "schedule"

export interface WorkflowTrigger {
  type: TriggerType
  /** For type 'event': the in-app event name that fires this workflow. */
  event?: string
  /** For type 'schedule': a cron expression (informational; runner computes next_run_at). */
  schedule_cron?: string
}

export type StepType =
  | "create_task"
  | "send_notification"
  | "ai_generate"
  | "search_index"
  | "http_request"
  | "condition"

export interface WorkflowStep {
  /** Unique id within the workflow. */
  id: string
  type: StepType
  /** User-facing label for the step. */
  label?: string
  /** Action-specific configuration. Values may reference `{{input.x}}` / `{{steps.id.field}}`. */
  config: Record<string, unknown>
  /** Next step id for linear flow (ignored for condition steps). */
  next?: string | null
  /** Condition steps: branch targets. */
  on_true?: string | null
  on_false?: string | null
}

export interface StepResult {
  step_id: string
  type: StepType
  status: "completed" | "failed" | "skipped"
  output?: unknown
  error?: string
}

export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

/** Serializable context passed to each step action. */
export interface StepContext {
  organizationId: string
  executionId: string
  workflowId: string
  /** Trigger input payload. */
  input: Record<string, unknown>
  /** Outputs of previously completed steps, keyed by step id. */
  steps: Record<string, unknown>
}
