import { generateText } from "ai"
import { createServiceClient } from "@/lib/supabase/service"
import { indexDocument } from "@/lib/search/index-helper"
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/config"
import type { ExecutionStatus, StepContext, StepResult, WorkflowStep } from "./types"

/* ─────────────────────────── persistence steps ─────────────────────────── */

/**
 * Durable persistence helpers used by the workflow orchestrator.
 *
 * These are `"use step"` functions so their bodies (and the service-role
 * client they use) are stripped from the workflow sandbox bundle. They write
 * directly via the Supabase client rather than importing the store module,
 * keeping Node-only dependencies (cron-parser, node:crypto) out of the
 * workflow bundle entirely.
 */
export async function markRunning(executionId: string) {
  "use step"
  const db = createServiceClient()
  await db.from("workflow_executions").update({ status: "running" }).eq("id", executionId)
}

export async function finalizeExecution(
  executionId: string,
  status: "completed" | "failed",
  stepResults: StepResult[],
  error: string | null,
) {
  "use step"
  const db = createServiceClient()
  await db
    .from("workflow_executions")
    .update({
      status: status as ExecutionStatus,
      step_results: stepResults,
      error,
      completed_at: new Date().toISOString(),
    })
    .eq("id", executionId)
}

/**
 * Module #6: Step actions.
 *
 * The single durable boundary is `executeStep` (a `"use step"`): the engine
 * (engine.ts, a `"use workflow"`) calls it once per workflow step, so each
 * workflow step maps to exactly one durable, retryable SDK step. The action
 * helpers below are plain functions invoked *inside* that step — they have
 * full Node.js access via the step, and keeping them out of `"use step"`
 * avoids nested steps and keeps the heavy `ai`/Supabase/search imports out of
 * the workflow sandbox bundle (which only sees the stripped step stubs).
 *
 * `executeStep` never throws — failures are captured into the returned
 * StepResult so the engine can record them and decide whether to continue.
 * All actions are tenant-scoped via `context.organizationId`.
 */

/* ───────────────────────── template resolution ───────────────────────── */

/** Resolve a single `{{path}}` token against the step context. */
function lookup(path: string, context: StepContext): unknown {
  const parts = path.trim().split(".")
  let cursor: unknown =
    parts[0] === "input" ? context.input : parts[0] === "steps" ? context.steps : undefined
  for (const key of parts.slice(1)) {
    if (cursor && typeof cursor === "object" && key in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return cursor
}

/** Resolve templates inside any config value (recursively). */
function resolve(value: unknown, context: StepContext): unknown {
  if (typeof value === "string") {
    // Exact single-token match: return the raw resolved value (preserves type).
    const exact = value.match(/^\{\{([^}]+)\}\}$/)
    if (exact) return lookup(exact[1], context)
    // Embedded tokens: string interpolation.
    return value.replace(/\{\{([^}]+)\}\}/g, (_, p) => {
      const v = lookup(p, context)
      return v == null ? "" : String(v)
    })
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, context))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolve(v, context)
    return out
  }
  return value
}

/* ─────────────────────────── action helpers ─────────────────────────── */

async function actionCreateTask(cfg: Record<string, unknown>, context: StepContext) {
  const db = createServiceClient()
  const { data, error } = await db
    .from("workflow_tasks")
    .insert({
      organization_id: context.organizationId,
      workflow_id: context.workflowId,
      execution_id: context.executionId,
      title: String(cfg.title ?? "Untitled task"),
      description: cfg.description != null ? String(cfg.description) : null,
      assignee_id: (cfg.assignee_id as string) ?? null,
      due_at: (cfg.due_at as string) ?? null,
    })
    .select("id, title, status")
    .single()

  if (error) throw new Error(`create_task failed: ${error.message}`)
  return data
}

async function actionSendNotification(cfg: Record<string, unknown>, context: StepContext) {
  // Record-only: the notification payload is persisted in the execution's
  // step_results. A future delivery module can consume these records.
  return {
    delivered: false,
    recorded_at: new Date().toISOString(),
    organization_id: context.organizationId,
    user_id: (cfg.user_id as string) ?? null,
    title: String(cfg.title ?? ""),
    body: cfg.body != null ? String(cfg.body) : null,
  }
}

async function actionAiGenerate(cfg: Record<string, unknown>) {
  const { text } = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: cfg.system != null ? String(cfg.system) : undefined,
    prompt: String(cfg.prompt ?? ""),
  })
  return { text }
}

async function actionSearchIndex(cfg: Record<string, unknown>, context: StepContext) {
  await indexDocument({
    organizationId: context.organizationId,
    resourceType: String(cfg.resource_type ?? "workflow"),
    resourceId: String(cfg.resource_id ?? context.executionId),
    title: String(cfg.title ?? ""),
    body: cfg.body != null ? String(cfg.body) : undefined,
    url: cfg.url != null ? String(cfg.url) : undefined,
  })
  return { indexed: true }
}

async function actionHttpRequest(cfg: Record<string, unknown>) {
  const method = String(cfg.method ?? "POST").toUpperCase()
  const url = String(cfg.url ?? "")
  if (!/^https?:\/\//.test(url)) throw new Error("http_request requires an absolute http(s) url")

  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...(cfg.headers as Record<string, string>) },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(cfg.body ?? {}),
  })

  const contentType = res.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json") ? await res.json() : await res.text()
  return { status: res.status, ok: res.ok, body: payload }
}

/** Evaluate a condition. Returns { matched }. */
function evaluateCondition(cfg: Record<string, unknown>): { matched: boolean } {
  const left = cfg.left
  const right = cfg.right
  const op = String(cfg.operator ?? "truthy")

  switch (op) {
    case "eq":
      return { matched: left === right }
    case "neq":
      return { matched: left !== right }
    case "gt":
      return { matched: Number(left) > Number(right) }
    case "lt":
      return { matched: Number(left) < Number(right) }
    case "contains":
      return { matched: String(left).includes(String(right)) }
    case "exists":
      return { matched: left !== undefined && left !== null }
    case "truthy":
    default:
      return { matched: Boolean(left) }
  }
}

/* ──────────────────────────── dispatcher ──────────────────────────── */

/**
 * Execute a single step. Never throws — failures are returned as a failed
 * StepResult so the durable engine can persist them deterministically.
 * For `condition` steps, `output` is `{ matched: boolean }`.
 */
export async function executeStep(step: WorkflowStep, context: StepContext): Promise<StepResult> {
  "use step"
  const cfg = resolve(step.config, context) as Record<string, unknown>
  try {
    let output: unknown
    switch (step.type) {
      case "create_task":
        output = await actionCreateTask(cfg, context)
        break
      case "send_notification":
        output = await actionSendNotification(cfg, context)
        break
      case "ai_generate":
        output = await actionAiGenerate(cfg)
        break
      case "search_index":
        output = await actionSearchIndex(cfg, context)
        break
      case "http_request":
        output = await actionHttpRequest(cfg)
        break
      case "condition":
        output = evaluateCondition(cfg)
        break
      default:
        throw new Error(`Unknown step type: ${(step as WorkflowStep).type}`)
    }
    return { step_id: step.id, type: step.type, status: "completed", output }
  } catch (err) {
    return {
      step_id: step.id,
      type: step.type,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
