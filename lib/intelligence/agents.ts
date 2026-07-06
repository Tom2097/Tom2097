import { createClient } from "../../lib/supabase/server"
import { createAuditEntry } from "../../lib/audit/append-only"

interface Agent {
  id: string
  name: string
  description: string
  permissions: string[]
  workspaceId: string
  isActive: boolean
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
  status: "pending" | "completed" | "failed"
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
  await createAuditLog({
    action: "agent_created",
    userId: "system",
    metadata: { agentId: data.id, workspaceId },
  })

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    workspaceId: data.workspace_id,
    isActive: data.is_active,
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

  // Create action record
  const { data, error } = await supabase
    .from("agent_actions")
    .insert([{
      agent_id: agentId,
      action,
      target_entity_id: targetEntityId,
      target_entity_type: targetEntityType,
      parameters,
      status: "pending",
      workspace_id: agent.workspace_id
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create action: ${error.message}`)

  // Audit log
  await createAuditLog({
    action: "agent_action_initiated",
    userId: agentId,
    metadata: { action, targetEntityId, targetEntityType, parameters },
  })

  // Execute action (mock implementation)
  const result = await mockActionExecution(agentId, action, parameters)

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
  await createAuditLog({
    action: "agent_action_completed",
    userId: agentId,
    metadata: {
      action,
      targetEntityId,
      targetEntityType,
      status: result.success ? "completed" : "failed",
      result: result.success ? result.data : { error: result.error }
    },
  })

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
 * Mock action execution.
 */
async function mockActionExecution(
  agentId: string,
  action: string,
  parameters: Record<string, unknown>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  console.log(`Agent ${agentId} executing action: ${action}`, parameters)
  
  // Mock action logic
  switch (action) {
    case "escalate_issue":
      return { success: true, data: { escalationId: "esc_123", status: "created" } }
    case "reroute_shipment":
      return { success: true, data: { newRoute: "alternative_route", eta: "2026-07-10T12:00:00Z" } }
    case "approve_refund":
      return { success: true, data: { refundId: "ref_456", amount: parameters.amount } }
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

  return data.map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    permissions: agent.permissions,
    workspaceId: agent.workspace_id,
    isActive: agent.is_active,
    createdAt: agent.created_at,
    updatedAt: agent.updated_at,
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

  return data.map((action) => ({
    id: action.id,
    agentId: action.agent_id,
    action: action.action,
    targetEntityId: action.target_entity_id,
    targetEntityType: action.target_entity_type,
    parameters: action.parameters,
    status: action.status,
    result: action.result,
    createdAt: action.created_at,
    completedAt: action.completed_at,
  }))
}