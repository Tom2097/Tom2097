import { createClient } from "@/lib/supabase/server"
import { createAuditEntry } from "@/lib/audit/append-only"
import { createTask } from "@/lib/crm/extensions"
import { CRM_ENTITY_TYPES, type CrmEntityType } from "@/lib/crm/types"
import { broadcast } from "@/lib/notifications/engine"

interface Agent {
  id: string
  name: string
  description: string
  permissions: string[]
  workspaceId: string
  isActive: boolean
  confidenceThreshold: number
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
}

interface AgentAction {
  id: string
  agentId: string
  action: string
  targetEntityId: string
  targetEntityType: string
  parameters: Record<string, unknown>
  status: "pending" | "pending_approval" | "approved" | "completed" | "failed"
  result?: Record<string, unknown>
  createdAt: string
  completedAt: string | null
}

/**
 * Creates a new autonomous agent.
 */
export async function createAgent(
  name: string,
  description: string,
  permissions: string[],
  workspaceId: string
): Promise<Agent> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agents")
    .insert([{
      name,
      description,
      permissions,
      workspace_id: workspaceId,
      is_active: true
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create agent: ${error.message}`)

  // Audit log
  await createAuditEntry(
    "agents",
    data.id,
    "INSERT",
    null,
    { agentId: data.id, workspaceId },
    "system",
    workspaceId
  )

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    workspaceId: data.workspace_id,
    isActive: data.is_active,
    confidenceThreshold: data.confidence_threshold,
    requiresApproval: data.requires_approval,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Executes an action with scoped permissions.
 */
export async function executeAction(
  agentId: string,
  action: string,
  targetEntityId: string,
  targetEntityType: string,
  parameters: Record<string, unknown>
): Promise<AgentAction> {
  const supabase = await createClient()

  // Verify agent exists and has permission
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single()

  if (!agent) throw new Error("Agent not found")
  if (!agent.is_active) throw new Error("Agent is inactive")
  if (!agent.permissions.includes(action)) {
    throw new Error("Agent lacks permission for this action")
  }

  // ---- Guardrails (architecture brief: "confidence thresholds,
  // human-in-the-loop... before any agent acts autonomously") ----
  //
  // requires_approval is the real, enforced gate: when set, the action is
  // recorded as "pending_approval" and executeAgentAction() is NOT called
  // here. It only runs once a human approves it via
  // POST /api/v1/intelligence/actions { action: "approve", actionId } (see
  // that route), which calls executeApprovedAction() below. Agents default
  // to requires_approval = true (fail closed); an explicit opt-out is
  // needed to get the old always-execute-immediately behavior back.
  //
  // confidence_threshold exists as a column on `agents` but is deliberately
  // NOT compared against anything here. No code path in this codebase
  // computes a real per-action confidence score for an agent_actions row --
  // the only "confidence" numbers that exist (lib/intelligence/confidence.ts,
  // intelligence_findings.confidence, CRM lead scoring, etc.) belong to
  // unrelated subsystems and say nothing about whether *this* action is
  // correct. Enforcing a threshold against a number nobody computes would be
  // exactly the kind of fabricated guardrail this fix is supposed to avoid,
  // so confidence_threshold is stored (for a future real confidence-scoring
  // pass to plug into) but only requires_approval is actually enforced.
  const requiresApproval = Boolean(agent.requires_approval)
  const initialStatus = requiresApproval ? "pending_approval" : "pending"

  // Create action record
  const { data, error } = await supabase
    .from("agent_actions")
    .insert([{
      agent_id: agentId,
      action,
      target_entity_id: targetEntityId,
      target_entity_type: targetEntityType,
      parameters,
      status: initialStatus,
      workspace_id: agent.workspace_id
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create action: ${error.message}`)

  // Audit log
  await createAuditEntry(
    "agent_actions",
    data.id,
    "INSERT",
    null,
    { action, targetEntityId, targetEntityType, parameters, status: initialStatus },
    agentId,
    agent.workspace_id
  )

  if (requiresApproval) {
    // Do not execute. The action sits at "pending_approval" until a human
    // approves it -- see executeApprovedAction() below.
    return {
      id: data.id,
      agentId: data.agent_id,
      action: data.action,
      targetEntityId: data.target_entity_id,
      targetEntityType: data.target_entity_type,
      parameters: data.parameters,
      status: "pending_approval",
      result: undefined,
      createdAt: data.created_at,
      completedAt: null,
    }
  }

  // Execute action for real -- see executeAgentAction() below.
  const result = await executeAgentAction(
    agentId,
    action,
    targetEntityId,
    targetEntityType,
    parameters,
    agent.workspace_id
  )

  // Update action status
  const { error: updateError } = await supabase
    .from("agent_actions")
    .update({
      status: result.success ? "completed" : "failed",
      result: result.success ? result.data : { error: result.error },
      completed_at: new Date().toISOString(),
    })
    .eq("id", data.id)

  if (updateError) console.error("Failed to update action status:", updateError)

  // Audit log
  await createAuditEntry(
    "agent_actions",
    data.id,
    "UPDATE",
    { status: "pending" },
    {
      action,
      targetEntityId,
      targetEntityType,
      status: result.success ? "completed" : "failed",
      result: result.success ? result.data : { error: result.error }
    },
    agentId,
    agent.workspace_id
  )

  return {
    id: data.id,
    agentId: data.agent_id,
    action: data.action,
    targetEntityId: data.target_entity_id,
    targetEntityType: data.target_entity_type,
    parameters: data.parameters,
    status: result.success ? "completed" : "failed",
    result: result.success ? result.data : { error: result.error },
    createdAt: data.created_at,
    completedAt: new Date().toISOString(),
  }
}

/**
 * Runs a previously-approved agent action for real. This is the other half
 * of the human-in-the-loop guardrail in executeAction(): approving an action
 * (POST /api/v1/intelligence/actions { action: "approve", actionId }) used
 * to just flip agent_actions.status to "approved" with no further effect --
 * that route now calls this function immediately afterward so approval
 * actually causes the action to run.
 *
 * Works for any agent_actions row currently in "approved" status, not only
 * ones created through executeAction()'s requires_approval branch -- e.g.
 * rows inserted directly by the "auto-assign" command in
 * app/api/v1/intelligence/actions/route.ts, which bypasses executeAction()
 * entirely, also become real once a human approves them.
 */
export async function executeApprovedAction(actionId: string): Promise<AgentAction> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("id", actionId)
    .single()

  if (error || !data) throw new Error("Action not found")
  if (data.status !== "approved") {
    throw new Error(`Action is not in an approved state (status: ${data.status})`)
  }

  const result = await executeAgentAction(
    data.agent_id,
    data.action,
    data.target_entity_id,
    data.target_entity_type,
    (data.parameters as Record<string, unknown>) ?? {},
    data.workspace_id
  )

  const { error: updateError } = await supabase
    .from("agent_actions")
    .update({
      status: result.success ? "completed" : "failed",
      result: result.success ? result.data : { error: result.error },
      completed_at: new Date().toISOString(),
    })
    .eq("id", actionId)

  if (updateError) console.error("Failed to update action status:", updateError)

  // Audit log
  await createAuditEntry(
    "agent_actions",
    actionId,
    "UPDATE",
    { status: "approved" },
    {
      action: data.action,
      targetEntityId: data.target_entity_id,
      targetEntityType: data.target_entity_type,
      status: result.success ? "completed" : "failed",
      result: result.success ? result.data : { error: result.error }
    },
    data.agent_id,
    data.workspace_id
  )

  return {
    id: actionId,
    agentId: data.agent_id,
    action: data.action,
    targetEntityId: data.target_entity_id,
    targetEntityType: data.target_entity_type,
    parameters: data.parameters,
    status: result.success ? "completed" : "failed",
    result: result.success ? result.data : { error: result.error },
    createdAt: data.created_at,
    completedAt: new Date().toISOString(),
  }
}

/**
 * Executes an agent's target action against real backing systems.
 *
 * Each case is honest about what actually happens:
 *  - "escalate_issue" creates a real CRM task (and, where possible, a real
 *    in-app notification) that a human will see -- there is no separate
 *    "escalation" subsystem in this app, so a high-priority task is the real
 *    thing an escalation maps to.
 *  - "reroute_shipment" has no backing system: there is no shipment/logistics
 *    routing concept anywhere in this codebase (only UI labels mentioning
 *    "logistics"/"shipping"), so this honestly fails rather than fabricating
 *    a route and ETA.
 *  - "approve_refund" has a real refund code path (`processRefund` in
 *    lib/billing/subscription-lifecycle.ts), but that function refunds and
 *    cancels an organization's *entire subscription* -- it has no concept of
 *    refunding an arbitrary amount against an arbitrary target entity, and it
 *    requires a human userId this agent-action flow doesn't have. Calling it
 *    here would either silently misuse it or require reinventing entity-level
 *    refund semantics that don't exist yet, so this honestly fails instead of
 *    pretending money moved.
 */
async function executeAgentAction(
  agentId: string,
  action: string,
  targetEntityId: string,
  targetEntityType: string,
  parameters: Record<string, unknown>,
  workspaceId: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  console.log(`Agent ${agentId} executing action: ${action}`, parameters)

  switch (action) {
    case "escalate_issue": {
      const isCrmEntityType = (CRM_ENTITY_TYPES as readonly string[]).includes(targetEntityType)
      const entityType = isCrmEntityType ? (targetEntityType as CrmEntityType) : null
      const reason = typeof parameters.reason === "string" ? parameters.reason : undefined

      try {
        // createTask()/broadcast() both need a real organization_id --
        // agents are workspace_id-scoped, a different id space entirely, so
        // resolve the workspace's actual org first rather than passing
        // workspaceId straight through (that silently tagged the task with
        // a nonexistent org and made broadcast() deliver to zero recipients).
        const supabase = await createClient()
        const { data: workspace, error: workspaceError } = await supabase
          .from("workspaces")
          .select("organization_id")
          .eq("id", workspaceId)
          .single()
        if (workspaceError || !workspace?.organization_id) {
          throw new Error(`Could not resolve organization for workspace ${workspaceId}`)
        }
        const organizationId = workspace.organization_id as string

        const task = await createTask(organizationId, agentId, {
          entity_type: entityType,
          entity_id: entityType ? targetEntityId : null,
          title: `Escalation: ${action} on ${targetEntityType} ${targetEntityId}`,
          description:
            reason ??
            `Automated escalation raised by agent ${agentId}` +
              (entityType ? "" : ` (target: ${targetEntityType} ${targetEntityId})`),
          priority: "high",
        })

        await broadcast(organizationId, {
          title: "Issue escalated",
          body: task.title,
          type: "warning",
          category: "escalation",
          priority: "high",
          source: "workflow",
          data: { taskId: task.id, agentId },
        })

        return { success: true, data: { taskId: task.id, status: task.status } }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to escalate issue",
        }
      }
    }
    case "reroute_shipment":
      return {
        success: false,
        error: "No real shipment-routing system exists yet -- this action cannot be performed.",
      }
    case "approve_refund":
      return {
        success: false,
        error:
          "No real entity-level refund system exists yet -- the only refund path (processRefund) " +
          "cancels and refunds an organization's entire subscription and requires a human user " +
          "context, so it cannot be safely triggered from an arbitrary agent action.",
      }
    default:
      return { success: false, error: "Unknown action" }
  }
}

/**
 * Lists all agents in a workspace.
 */
export async function listAgents(workspaceId: string): Promise<Agent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(`Failed to list agents: ${error.message}`)

  return data.map((agent: Record<string, unknown>) => ({
    id: agent.id as string,
    name: agent.name as string,
    description: agent.description as string,
    permissions: agent.permissions as string[],
    workspaceId: agent.workspace_id as string,
    isActive: agent.is_active as boolean,
    confidenceThreshold: agent.confidence_threshold as number,
    requiresApproval: agent.requires_approval as boolean,
    createdAt: agent.created_at as string,
    updatedAt: agent.updated_at as string,
  }))
}

/**
 * Gets an agent by ID.
 */
export async function getAgent(agentId: string): Promise<Agent | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single()

  if (error) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    workspaceId: data.workspace_id,
    isActive: data.is_active,
    confidenceThreshold: data.confidence_threshold,
    requiresApproval: data.requires_approval,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Gets audit trail for an agent.
 */
export async function getAuditTrail(agentId: string): Promise<AgentAction[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Failed to get audit trail: ${error.message}`)

  return data.map((action: Record<string, unknown>) => ({
    id: action.id as string,
    agentId: action.agent_id as string,
    action: action.action as string,
    targetEntityId: action.target_entity_id as string,
    targetEntityType: action.target_entity_type as string,
    parameters: action.parameters as Record<string, unknown>,
    status: action.status as "pending" | "pending_approval" | "approved" | "completed" | "failed",
    result: action.result as Record<string, unknown> | undefined,
    createdAt: action.created_at as string,
    completedAt: action.completed_at as string | null,
  }))
}
