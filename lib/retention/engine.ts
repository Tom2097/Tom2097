import { createServiceClient } from "@/lib/supabase/service"
import { runRetentionCleanup } from "@/lib/audit/store"
import {
  DELEGATED_RESOURCE_TYPES,
  MAX_INTERVAL_HOURS,
  MAX_RETENTION_DAYS,
  MIN_INTERVAL_HOURS,
  MIN_RETENTION_DAYS,
  RETENTION_RESOURCE_TYPES,
  type ListPoliciesOptions,
  type ListRunsOptions,
  type RetentionPolicy,
  type RetentionPolicyInput,
  type RetentionPolicyUpdateInput,
  type RetentionResourceType,
  type RetentionRun,
  type RunResult,
  type RunStatus,
  type RunTrigger,
} from "./types"

/**
 * Module #15: Data Retention engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary from Module #1.
 *
 * Boundary with Module #10: audit-log retention is owned by Module #10. A
 * policy with resource_type="audit_logs" delegates its purge to that module's
 * `runRetentionCleanup`. All other resource types are purged via the DB-side
 * whitelist function `data_retention_purge`. No arbitrary table is ever named
 * by application code.
 */

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.trunc(v) : Number.NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

function nextRunFrom(intervalHours: number, from: Date = new Date()): string {
  return new Date(from.getTime() + intervalHours * 3_600_000).toISOString()
}

// ── Supported-resource registry ────────────────────────────────────────────────

export function isSupportedResourceType(v: unknown): v is RetentionResourceType {
  return typeof v === "string" && (RETENTION_RESOURCE_TYPES as readonly string[]).includes(v)
}

export function isDelegated(resourceType: RetentionResourceType): boolean {
  return DELEGATED_RESOURCE_TYPES.includes(resourceType)
}

export function listSupportedResourceTypes(): readonly RetentionResourceType[] {
  return RETENTION_RESOURCE_TYPES
}

// ── Policy CRUD ──────────────────────────────────────────────────────────────

export function validatePolicyInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return "policy must be an object"
  const p = input as RetentionPolicyInput
  if (!isSupportedResourceType(p.resource_type)) {
    return `resource_type must be one of: ${RETENTION_RESOURCE_TYPES.join(", ")}`
  }
  if (
    p.retention_days !== undefined &&
    (typeof p.retention_days !== "number" ||
      p.retention_days < MIN_RETENTION_DAYS ||
      p.retention_days > MAX_RETENTION_DAYS)
  ) {
    return `retention_days must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`
  }
  return null
}

export async function listPolicies(
  organizationId: string,
  opts: ListPoliciesOptions = {},
): Promise<RetentionPolicy[]> {
  const db = createServiceClient()
  let q = db
    .from("retention_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("resource_type", { ascending: true })

  if (opts.resourceType) q = q.eq("resource_type", opts.resourceType)
  if (opts.enabledOnly) q = q.eq("is_enabled", true)

  const { data, error } = await q
  if (error) {
    console.log("[v0] listPolicies failed:", error.message)
    throw new Error("failed to list retention policies")
  }
  return (data ?? []) as RetentionPolicy[]
}

export async function getPolicy(
  organizationId: string,
  policyId: string,
): Promise<RetentionPolicy | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("retention_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", policyId)
    .maybeSingle()
  if (error) {
    console.log("[v0] getPolicy failed:", error.message)
    throw new Error("failed to load retention policy")
  }
  return (data as RetentionPolicy) ?? null
}

export async function createPolicy(
  organizationId: string,
  createdBy: string,
  input: RetentionPolicyInput,
): Promise<RetentionPolicy> {
  const db = createServiceClient()
  const intervalHours = clampInt(
    input.schedule_interval_hours,
    MIN_INTERVAL_HOURS,
    MAX_INTERVAL_HOURS,
    24,
  )
  const { data, error } = await db
    .from("retention_policies")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      resource_type: input.resource_type,
      retention_days: clampInt(input.retention_days, MIN_RETENTION_DAYS, MAX_RETENTION_DAYS, 365),
      is_enabled: input.is_enabled ?? true,
      schedule_interval_hours: intervalHours,
      description: clampStr(input.description, 500),
      next_run_at: nextRunFrom(intervalHours),
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new Error("a retention policy already exists for this resource type")
    }
    console.log("[v0] createPolicy failed:", error.message)
    throw new Error("failed to create retention policy")
  }
  return data as RetentionPolicy
}

export async function updatePolicy(
  organizationId: string,
  policyId: string,
  input: RetentionPolicyUpdateInput,
): Promise<RetentionPolicy | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = {}

  if (input.retention_days !== undefined) {
    patch.retention_days = clampInt(
      input.retention_days,
      MIN_RETENTION_DAYS,
      MAX_RETENTION_DAYS,
      365,
    )
  }
  if (input.is_enabled !== undefined) patch.is_enabled = !!input.is_enabled
  if (input.schedule_interval_hours !== undefined) {
    patch.schedule_interval_hours = clampInt(
      input.schedule_interval_hours,
      MIN_INTERVAL_HOURS,
      MAX_INTERVAL_HOURS,
      24,
    )
  }
  if (input.description !== undefined) patch.description = clampStr(input.description, 500)

  if (Object.keys(patch).length === 0) return getPolicy(organizationId, policyId)

  const { data, error } = await db
    .from("retention_policies")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", policyId)
    .select("*")
    .maybeSingle()

  if (error) {
    console.log("[v0] updatePolicy failed:", error.message)
    throw new Error("failed to update retention policy")
  }
  return (data as RetentionPolicy) ?? null
}

export async function deletePolicy(organizationId: string, policyId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("retention_policies")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", policyId)
    .select("id")
    .maybeSingle()
  if (error) {
    console.log("[v0] deletePolicy failed:", error.message)
    throw new Error("failed to delete retention policy")
  }
  return !!data
}

// ── Purge execution ────────────────────────────────────────────────────────────

/**
 * Execute the purge for a single policy. Audit logs are delegated to Module #10;
 * everything else goes through the whitelist-only `data_retention_purge` RPC.
 * Always records a row in retention_runs and refreshes the policy rollup.
 */
export async function runPolicy(
  organizationId: string,
  policy: RetentionPolicy,
  trigger: RunTrigger,
  triggeredBy: string | null,
): Promise<RunResult> {
  const db = createServiceClient()
  let status: RunStatus = "success"
  let deleted = 0
  let errorMsg: string | undefined

  try {
    if (isDelegated(policy.resource_type)) {
      // Module #10 owns audit-log retention — reuse it.
      deleted = await runRetentionCleanup(organizationId, policy.retention_days, triggeredBy ?? undefined)
    } else {
      const { data, error } = await db.rpc("data_retention_purge", {
        p_organization_id: organizationId,
        p_resource_type: policy.resource_type,
        p_retention_days: policy.retention_days,
      })
      if (error) throw new Error(error.message)
      deleted = (data as number) ?? 0
    }
  } catch (err) {
    status = "failed"
    errorMsg = err instanceof Error ? err.message : String(err)
    console.log("[v0] runPolicy purge failed:", errorMsg)
  }

  // Record the run.
  await db.from("retention_runs").insert({
    organization_id: organizationId,
    policy_id: policy.id,
    resource_type: policy.resource_type,
    retention_days: policy.retention_days,
    status,
    deleted_count: deleted,
    trigger,
    error: errorMsg ?? null,
    triggered_by: triggeredBy,
  })

  // Refresh policy rollup + advance schedule.
  await db
    .from("retention_policies")
    .update({
      last_run_at: new Date().toISOString(),
      last_deleted_count: deleted,
      next_run_at: nextRunFrom(policy.schedule_interval_hours),
    })
    .eq("organization_id", organizationId)
    .eq("id", policy.id)

  return {
    policyId: policy.id,
    resourceType: policy.resource_type,
    status,
    deletedCount: deleted,
    error: errorMsg,
  }
}

/** Run a policy by id (manual trigger from the API). */
export async function runPolicyById(
  organizationId: string,
  policyId: string,
  triggeredBy: string | null,
): Promise<RunResult | null> {
  const policy = await getPolicy(organizationId, policyId)
  if (!policy) return null
  return runPolicy(organizationId, policy, "manual", triggeredBy)
}

// ── Scheduled runner (cron) ──────────────────────────────────────────────────

/**
 * Process all due, enabled policies across organizations. Invoked by the cron
 * endpoint (service-role; spans tenants). Tenant scoping comes from each
 * policy's own organization_id.
 */
export async function runDuePolicies(limit = 200): Promise<RunResult[]> {
  const db = createServiceClient()
  const { data, error } = await db.rpc("get_due_retention_policies", { p_limit: limit })
  if (error) {
    console.log("[v0] get_due_retention_policies failed:", error.message)
    throw new Error("failed to load due retention policies")
  }
  const due = (data ?? []) as RetentionPolicy[]
  const results: RunResult[] = []
  for (const policy of due) {
    results.push(await runPolicy(policy.organization_id, policy, "scheduled", null))
  }
  return results
}

// ── Run log ──────────────────────────────────────────────────────────────────

export async function listRuns(
  organizationId: string,
  opts: ListRunsOptions = {},
): Promise<{ runs: RetentionRun[]; total: number }> {
  const db = createServiceClient()
  const limit = clampInt(opts.limit, 1, 500, 50)
  const offset = clampInt(opts.offset, 0, 1_000_000, 0)

  let q = db
    .from("retention_runs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.policyId) q = q.eq("policy_id", opts.policyId)
  if (opts.resourceType) q = q.eq("resource_type", opts.resourceType)
  if (opts.status) q = q.eq("status", opts.status)

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.log("[v0] listRuns failed:", error.message)
    throw new Error("failed to list retention runs")
  }
  return { runs: (data ?? []) as RetentionRun[], total: count ?? 0 }
}
