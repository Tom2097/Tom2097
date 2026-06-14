import { randomBytes } from "node:crypto"
import { CronExpressionParser } from "cron-parser"
import { createServiceClient } from "@/lib/supabase/service"
import type { WorkflowStep, WorkflowTrigger, ExecutionStatus, StepResult } from "./types"

/**
 * Module #6: Workflow store.
 *
 * Plain server-side data helpers used by API routes and durable step
 * functions. Uses the service-role client and ALWAYS scopes by
 * organization_id manually (RLS is bypassed), mirroring the Module #2/#3
 * pattern. The only exception is webhook lookup, where the unguessable
 * token is itself the tenant-scoping credential.
 */

export interface WorkflowRecord {
  id: string
  organization_id: string
  name: string
  description: string | null
  enabled: boolean
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  webhook_token: string | null
  next_run_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Compute the next run timestamp for a cron expression, or null if invalid. */
export function computeNextRun(cron: string, from: Date = new Date()): string | null {
  try {
    const interval = CronExpressionParser.parse(cron, { currentDate: from, tz: "UTC" })
    return interval.next().toDate().toISOString()
  } catch {
    return null
  }
}

export async function listWorkflows(organizationId: string): Promise<WorkflowRecord[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflows")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (error) {
    console.log("[v0] listWorkflows error:", error.message)
    return []
  }
  return (data ?? []) as WorkflowRecord[]
}

export async function getWorkflow(organizationId: string, id: string): Promise<WorkflowRecord | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflows")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single()

  if (error) {
    console.log("[v0] getWorkflow error:", error.message)
    return null
  }
  return data as WorkflowRecord
}

/** Look up a workflow by its webhook token. Token is the auth credential. */
export async function getWorkflowByWebhookToken(token: string): Promise<WorkflowRecord | null> {
  const db = createServiceClient()
  const { data, error } = await db.from("workflows").select("*").eq("webhook_token", token).single()
  if (error) return null
  return data as WorkflowRecord
}

export interface CreateWorkflowInput {
  name: string
  description?: string | null
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  enabled?: boolean
}

export async function createWorkflow(
  organizationId: string,
  createdBy: string,
  input: CreateWorkflowInput,
): Promise<WorkflowRecord | null> {
  const db = createServiceClient()

  // Webhook triggers get an unguessable token; schedule triggers get next_run_at.
  const webhookToken = input.trigger.type === "webhook" ? randomBytes(24).toString("hex") : null
  const nextRunAt =
    input.trigger.type === "schedule" && input.trigger.schedule_cron
      ? computeNextRun(input.trigger.schedule_cron)
      : null

  const { data, error } = await db
    .from("workflows")
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description ?? null,
      trigger: input.trigger,
      steps: input.steps,
      enabled: input.enabled ?? true,
      webhook_token: webhookToken,
      next_run_at: nextRunAt,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    console.log("[v0] createWorkflow error:", error.message)
    return null
  }
  return data as WorkflowRecord
}

export interface UpdateWorkflowInput {
  name?: string
  description?: string | null
  trigger?: WorkflowTrigger
  steps?: WorkflowStep[]
  enabled?: boolean
}

export async function updateWorkflow(
  organizationId: string,
  id: string,
  updates: UpdateWorkflowInput,
): Promise<WorkflowRecord | null> {
  const db = createServiceClient()

  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }

  // Recompute scheduling metadata if the trigger changed.
  if (updates.trigger) {
    patch.webhook_token =
      updates.trigger.type === "webhook" ? randomBytes(24).toString("hex") : null
    patch.next_run_at =
      updates.trigger.type === "schedule" && updates.trigger.schedule_cron
        ? computeNextRun(updates.trigger.schedule_cron)
        : null
  }

  const { data, error } = await db
    .from("workflows")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single()

  if (error) {
    console.log("[v0] updateWorkflow error:", error.message)
    return null
  }
  return data as WorkflowRecord
}

export async function deleteWorkflow(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from("workflows").delete().eq("id", id).eq("organization_id", organizationId)
  if (error) {
    console.log("[v0] deleteWorkflow error:", error.message)
    return false
  }
  return true
}

export async function setWorkflowEnabled(
  organizationId: string,
  id: string,
  enabled: boolean,
): Promise<WorkflowRecord | null> {
  return updateWorkflow(organizationId, id, { enabled })
}

/* ──────────────────────────── Executions ──────────────────────────── */

export interface ExecutionRecord {
  id: string
  workflow_id: string
  organization_id: string
  status: ExecutionStatus
  trigger_type: string
  run_id: string | null
  input: Record<string, unknown>
  step_results: StepResult[]
  error: string | null
  started_by: string | null
  started_at: string
  completed_at: string | null
}

export async function createExecution(
  organizationId: string,
  workflowId: string,
  triggerType: string,
  input: Record<string, unknown>,
  startedBy: string | null,
): Promise<ExecutionRecord | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflow_executions")
    .insert({
      organization_id: organizationId,
      workflow_id: workflowId,
      trigger_type: triggerType,
      input,
      started_by: startedBy,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    console.log("[v0] createExecution error:", error.message)
    return null
  }
  return data as ExecutionRecord
}

export async function updateExecution(
  executionId: string,
  patch: Partial<{
    status: ExecutionStatus
    run_id: string | null
    step_results: StepResult[]
    error: string | null
    completed_at: string | null
  }>,
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db.from("workflow_executions").update(patch).eq("id", executionId)
  if (error) {
    console.log("[v0] updateExecution error:", error.message)
  }
}

export async function listExecutions(
  organizationId: string,
  workflowId?: string,
  limit = 50,
): Promise<ExecutionRecord[]> {
  const db = createServiceClient()
  let query = db
    .from("workflow_executions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (workflowId) query = query.eq("workflow_id", workflowId)

  const { data, error } = await query
  if (error) {
    console.log("[v0] listExecutions error:", error.message)
    return []
  }
  return (data ?? []) as ExecutionRecord[]
}

export async function getExecution(
  organizationId: string,
  id: string,
): Promise<ExecutionRecord | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflow_executions")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single()
  if (error) return null
  return data as ExecutionRecord
}

/* ──────────────────────────── Scheduling ──────────────────────────── */

/** Find enabled scheduled workflows that are due to run (next_run_at <= now). */
export async function listDueScheduledWorkflows(now: Date = new Date()): Promise<WorkflowRecord[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflows")
    .select("*")
    .eq("enabled", true)
    .not("next_run_at", "is", null)
    .lte("next_run_at", now.toISOString())

  if (error) {
    console.log("[v0] listDueScheduledWorkflows error:", error.message)
    return []
  }
  return (data ?? []) as WorkflowRecord[]
}

/** Advance a scheduled workflow's next_run_at after firing. */
export async function advanceSchedule(workflow: WorkflowRecord, from: Date = new Date()): Promise<void> {
  if (workflow.trigger.type !== "schedule" || !workflow.trigger.schedule_cron) return
  const next = computeNextRun(workflow.trigger.schedule_cron, from)
  const db = createServiceClient()
  await db.from("workflows").update({ next_run_at: next }).eq("id", workflow.id)
}

/** Find enabled workflows in an org whose event trigger matches the given event name. */
export async function listWorkflowsForEvent(
  organizationId: string,
  eventName: string,
): Promise<WorkflowRecord[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .eq("trigger->>type", "event")
    .eq("trigger->>event", eventName)

  if (error) {
    console.log("[v0] listWorkflowsForEvent error:", error.message)
    return []
  }
  return (data ?? []) as WorkflowRecord[]
}
