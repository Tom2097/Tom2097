import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"
import { createNotification } from "@/lib/notifications/engine"
import { resolveAssignee } from "./routing"
import type {
  AssignableRole,
  HarDecision,
  HumanActionRequest,
  TriggerClass,
  HarType,
  HarPriority,
  HarOption,
  AiRecommendation,
} from "./types"

export interface RaiseHarInput {
  organizationId: string
  workflowRunId?: string | null
  stepKey?: string | null
  type?: HarType
  triggerClass: TriggerClass
  reason: string
  contextSummary?: string | null
  requestedOf?: string | null
  options?: HarOption[]
  aiRecommendation?: AiRecommendation | null
  triggeredBy?: string | null
  assigneeRole?: AssignableRole | null
  assigneeUserId?: string | null
  priority?: HarPriority
  dueAt?: string | null
  slaHours?: number | null
}

/**
 * Raises a Human Action Request. This is the "ask" beat: it never blocks a
 * worker (spec section 2) -- it's a plain insert plus a fire-and-forget
 * notification, not a held connection or a sleeping thread.
 *
 * Assignment: either assigneeUserId is given directly, or assigneeRole is
 * resolved to a named person via resolveAssignee() (role -> owner
 * fallback, separation-of-duties aware). If NEITHER resolves to anyone
 * (an org with no owner at all should be impossible per
 * 20260825000000_owner_role.sql's invariant, but this must never silently
 * drop the request if it somehow happens) the HAR is still created with a
 * null assignee and status stays "open" -- raising a control must never
 * fail the workflow step it exists to protect.
 */
// Founder's Tier 1 decision: default timeout behavior is "escalate to the
// owner", not "hold indefinitely" -- so every HAR gets a real due_at unless
// the caller sets one explicitly, matching the spec's own escalation-ladder
// figure (its "+24h escalate to manager" rung is the last hop before
// expiry; Tier 0 has no expiry tier yet, so 24h is where the one-hop
// owner-escalation this app actually has fires).
const DEFAULT_SLA_HOURS = 24

export async function raiseHAR(input: RaiseHarInput): Promise<HumanActionRequest | null> {
  const db = createServiceClient()

  let assigneeUserId = input.assigneeUserId ?? null
  let resolvedRole: AssignableRole | null = input.assigneeRole ?? null
  let hopType: "initial" | "fallback" | "self" = "initial"
  const slaHours = input.slaHours ?? DEFAULT_SLA_HOURS
  const dueAt = input.dueAt ?? new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString()

  if (!assigneeUserId && input.assigneeRole) {
    // allowSelfFallback: a solo-owner org (or the last remaining holder of
    // this role) must still get a real assignee -- actOnHAR's matching
    // self-approval exception is what makes assigning it to the triggering
    // user themselves safe, rather than leaving the HAR unassigned forever.
    const resolved = await resolveAssignee(input.organizationId, input.assigneeRole, input.triggeredBy ?? undefined, {
      allowSelfFallback: true,
    })
    if (resolved) {
      assigneeUserId = resolved.userId
      resolvedRole = resolved.resolvedRole
      hopType = resolved.hopType
    }
  }

  const { data: har, error } = await db
    .from("human_action_requests")
    .insert({
      organization_id: input.organizationId,
      workflow_run_id: input.workflowRunId ?? null,
      step_key: input.stepKey ?? null,
      type: input.type ?? "approve",
      trigger_class: input.triggerClass,
      reason: input.reason,
      context_summary: input.contextSummary ?? null,
      requested_of: input.requestedOf ?? null,
      options: input.options ?? [],
      ai_recommendation: input.aiRecommendation ?? null,
      triggered_by: input.triggeredBy ?? null,
      assignee_role: resolvedRole,
      assignee_user_id: assigneeUserId,
      priority: input.priority ?? "normal",
      due_at: dueAt,
      sla_hours: slaHours,
      status: "open",
    })
    .select("*")
    .single()

  if (error || !har) {
    console.error("[hitl] raiseHAR failed:", error?.message)
    return null
  }

  if (input.workflowRunId) {
    await db
      .from("workflow_runs")
      .update({ status: "awaiting_human", current_step_key: input.stepKey ?? null, updated_at: new Date().toISOString() })
      .eq("id", input.workflowRunId)
  }

  if (assigneeUserId) {
    await db.from("har_assignments").insert({
      har_id: har.id,
      organization_id: input.organizationId,
      assigned_role: resolvedRole,
      assigned_user_id: assigneeUserId,
      hop_type: hopType,
      reason:
        hopType === "fallback"
          ? "role had no eligible assignee; fell back to owner"
          : hopType === "self"
            ? "no one else eligible; assigned to the triggering user (self-approval last resort)"
            : null,
    })

    await publish({
      type: "human.action.assigned",
      organization_id: input.organizationId,
      data: { har_id: har.id, assignee_user_id: assigneeUserId, assignee_role: resolvedRole },
    })

    // In-app is the only channel Tier 0 wires (spec's own build order:
    // ship in-app + dashboard widget first, email/Slack/Teams/push later).
    await createNotification(input.organizationId, {
      user_id: assigneeUserId,
      title: "Action needed",
      body: input.reason,
      type: "warning",
      category: "hitl",
      priority: input.priority === "urgent" || input.priority === "high" ? "high" : "normal",
      action_url: `/approvals/${har.id}`,
      data: { har_id: har.id },
      source: "workflow",
    })

    await db
      .from("human_action_requests")
      .update({ status: "notified", notified_at: new Date().toISOString(), channel_used: "in_app" })
      .eq("id", har.id)

    await publish({
      type: "human.action.notified",
      organization_id: input.organizationId,
      data: { har_id: har.id, channel: "in_app" },
    })
  }

  await publish({
    type: "human.action.requested",
    organization_id: input.organizationId,
    data: { har_id: har.id, workflow_run_id: input.workflowRunId ?? null, trigger_class: input.triggerClass, reason: input.reason },
  })

  return { ...har, status: assigneeUserId ? "notified" : "open" } as HumanActionRequest
}

export async function getHAR(organizationId: string, harId: string): Promise<HumanActionRequest | null> {
  const db = createServiceClient()
  const { data } = await db
    .from("human_action_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", harId)
    .maybeSingle()
  return data as HumanActionRequest | null
}

export async function listOpenHARsForUser(organizationId: string, userId: string): Promise<HumanActionRequest[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("human_action_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("assignee_user_id", userId)
    .in("status", ["open", "notified", "escalated"])
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
  return (data ?? []) as HumanActionRequest[]
}

export interface ActOnHarInput {
  organizationId: string
  harId: string
  actorId: string
  action: HarDecision
  reason?: string | null
  channel?: string
  delegateToUserId?: string | null
}

export interface ActOnHarResult {
  success: boolean
  error?: string
  har?: HumanActionRequest
}

const TERMINAL_ACTIONS: HarDecision[] = ["approve", "reject", "edit"]

/**
 * Acts on a HAR (spec section 6). Every action -- terminal or not -- emits
 * a har_actions row (the append-only audit trail, spec section 9). Only
 * approve/reject/edit are terminal: they close the HAR and resume the
 * workflow run. delegate/escalate re-route it; request_info is recorded
 * but Tier 0 has no live "bounce back to the AI" re-prompt loop to trigger
 * (that needs a real workflow wired through this, which is Tier 2) -- it's
 * logged honestly rather than faked.
 */
export async function actOnHAR(input: ActOnHarInput): Promise<ActOnHarResult> {
  const db = createServiceClient()

  const { data: har } = await db
    .from("human_action_requests")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.harId)
    .maybeSingle()

  if (!har) return { success: false, error: "Request not found" }
  if (!["open", "notified", "escalated"].includes(har.status)) {
    return { success: false, error: "This request has already been resolved" }
  }

  // Separation of duties (spec section 4): the user who triggered the
  // underlying step can never be the one who acts on it, regardless of who
  // it's currently assigned to -- UNLESS no other eligible person exists
  // for this HAR's role (a single-person org, or the last remaining holder
  // of the assignee role). That's the founder's Tier 1 decision: strict
  // whenever a real choice exists, a flagged last resort otherwise, never
  // silently indistinguishable from a real second-person approval
  // (self_approved on the audit row is what preserves that distinction).
  let selfApproved = false
  if (har.triggered_by && har.triggered_by === input.actorId) {
    const roleToCheck = (har.assignee_role as AssignableRole | null) ?? "owner"
    const anyoneElse = await resolveAssignee(input.organizationId, roleToCheck, input.actorId)
    if (anyoneElse) {
      return { success: false, error: "You cannot act on a request you triggered" }
    }
    selfApproved = true
  }

  if (!selfApproved && har.assignee_user_id && har.assignee_user_id !== input.actorId) {
    return { success: false, error: "This request is assigned to someone else" }
  }

  if (input.action === "reject" && !input.reason?.trim()) {
    return { success: false, error: "A reason is required to reject" }
  }

  if (input.action === "delegate" && !input.delegateToUserId) {
    return { success: false, error: "delegateToUserId is required to delegate" }
  }

  const channel = input.channel ?? "in_app"

  await db.from("har_actions").insert({
    har_id: har.id,
    organization_id: input.organizationId,
    actor_id: input.actorId,
    action: input.action,
    reason: input.reason ?? null,
    channel,
    self_approved: selfApproved,
  })

  if (input.action === "delegate") {
    const delegateTo = input.delegateToUserId as string
    await db
      .from("human_action_requests")
      .update({ assignee_user_id: delegateTo, status: "notified" })
      .eq("id", har.id)
    await db.from("har_assignments").insert({
      har_id: har.id,
      organization_id: input.organizationId,
      assigned_user_id: delegateTo,
      assigned_by: input.actorId,
      hop_type: "delegation",
      reason: input.reason ?? null,
    })
    await createNotification(input.organizationId, {
      user_id: delegateTo,
      title: "Action needed (delegated to you)",
      body: har.reason,
      type: "warning",
      category: "hitl",
      priority: "normal",
      action_url: `/approvals/${har.id}`,
      data: { har_id: har.id },
      source: "workflow",
    })
    return { success: true }
  }

  if (input.action === "escalate") {
    const resolved = await resolveAssignee(input.organizationId, "owner", input.actorId)
    if (!resolved) {
      return { success: false, error: "No one available to escalate to" }
    }
    await db
      .from("human_action_requests")
      .update({ assignee_user_id: resolved.userId, assignee_role: "owner", status: "escalated" })
      .eq("id", har.id)
    await db.from("har_assignments").insert({
      har_id: har.id,
      organization_id: input.organizationId,
      assigned_role: "owner",
      assigned_user_id: resolved.userId,
      assigned_by: input.actorId,
      hop_type: "escalation",
      reason: input.reason ?? null,
    })
    await createNotification(input.organizationId, {
      user_id: resolved.userId,
      title: "Escalated: action needed",
      body: har.reason,
      type: "warning",
      category: "hitl",
      priority: "high",
      action_url: `/approvals/${har.id}`,
      data: { har_id: har.id },
      source: "workflow",
    })
    return { success: true }
  }

  if (input.action === "request_info") {
    // Recorded, not resolved -- stays assigned/open so it still shows up in
    // the assignee's queue until a real continuation exists (Tier 2).
    return { success: true }
  }

  if (TERMINAL_ACTIONS.includes(input.action)) {
    const { data: updated } = await db
      .from("human_action_requests")
      .update({
        status: "acted",
        decision: input.action,
        reason_given: input.reason ?? null,
        acted_at: new Date().toISOString(),
        acted_by: input.actorId,
        channel_used: channel,
      })
      .eq("id", har.id)
      .select("*")
      .single()

    if (har.workflow_run_id) {
      await db
        .from("workflow_runs")
        .update({ status: "resumed", updated_at: new Date().toISOString() })
        .eq("id", har.workflow_run_id)
    }

    await publish({
      type: "human.action.completed",
      organization_id: input.organizationId,
      data: { har_id: har.id, workflow_run_id: har.workflow_run_id, decision: input.action },
    })

    return { success: true, har: updated as HumanActionRequest }
  }

  return { success: false, error: "Unknown action" }
}

/**
 * Scheduled sweep (mirrors subscription-lifecycle.ts's expireAllDueTrials
 * and dunning.ts's retryAllDueDunning): the founder's Tier 1 default --
 * "escalate to the owner" when nobody responds before due_at, never
 * auto-approve. Skips HARs already assigned to the owner (there's nowhere
 * further to escalate to in Tier 0's one-hop ladder -- it just stays
 * escalated/overdue until acted on or manually re-routed).
 *
 * actor_id is null on the har_actions row this inserts -- a system timeout
 * isn't "a named person decided" (20260902000000 made the column
 * nullable specifically for this).
 */
export async function escalateOverdueHARs(): Promise<{ processed: number; escalated: number }> {
  const db = createServiceClient()

  const { data: overdue } = await db
    .from("human_action_requests")
    .select("*")
    .in("status", ["open", "notified"])
    .not("due_at", "is", null)
    .lte("due_at", new Date().toISOString())

  const rows = (overdue ?? []) as HumanActionRequest[]
  let escalated = 0

  for (const har of rows) {
    if (har.assignee_role === "owner") continue

    const resolved = await resolveAssignee(har.organization_id, "owner", har.triggered_by ?? undefined)
    if (!resolved) continue

    await db
      .from("human_action_requests")
      .update({ assignee_user_id: resolved.userId, assignee_role: "owner", status: "escalated" })
      .eq("id", har.id)

    await db.from("har_assignments").insert({
      har_id: har.id,
      organization_id: har.organization_id,
      assigned_role: "owner",
      assigned_user_id: resolved.userId,
      hop_type: "escalation",
      reason: "SLA timeout -- auto-escalated",
    })

    await db.from("har_actions").insert({
      har_id: har.id,
      organization_id: har.organization_id,
      actor_id: null,
      action: "escalate",
      reason: "SLA timeout -- auto-escalated",
      channel: "system",
      self_approved: false,
    })

    await createNotification(har.organization_id, {
      user_id: resolved.userId,
      title: "Escalated: action needed (SLA expired)",
      body: har.reason,
      type: "warning",
      category: "hitl",
      priority: "high",
      action_url: `/approvals/${har.id}`,
      data: { har_id: har.id },
      source: "system",
    })

    await publish({
      type: "human.action.escalated",
      organization_id: har.organization_id,
      data: { har_id: har.id, escalated_to: resolved.userId, reason: "sla_timeout" },
    })

    escalated++
  }

  return { processed: rows.length, escalated }
}
