import { createServiceClient } from "@/lib/supabase/service"

import { evaluateGuardrail } from "./confidence"
import { generateId } from "@/lib/utils/id"
import { getActiveFindings } from "./engine"
import type { IntelligenceFinding } from "./types"

const AGENTS_TABLE = "intelligence_agents"
const ACTIONS_TABLE = "intelligence_actions"

export interface AgentAction {
  id: string
  agentId: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'approved' | 'pending_approval'
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  targetModule?: string
  config?: Record<string, unknown>
  confidence?: number
  requiresApproval?: boolean
}

interface AgentDefinition {
  id: string
  name: string
  description: string
  scope: string[]
  capabilities: string[]
  confidenceThreshold: number
  requiresApproval: boolean
}

export const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    id: "compliance-agent",
    name: "Compliance Guardian",
    description: "Monitors certification expirations, compliance gaps, and CAPA status",
    scope: ["compliance"],
    capabilities: ["renew_certification", "create_remediation_plan", "schedule_audit"],
    confidenceThreshold: 0.8,
    requiresApproval: true,
  },
  {
    id: "resources-agent",
    name: "Resource Optimizer",
    description: "Tracks inventory levels, maintenance schedules, and asset utilization",
    scope: ["resources"],
    capabilities: ["create_purchase_order", "schedule_maintenance", "reallocate_assets"],
    confidenceThreshold: 0.75,
    requiresApproval: true,
  },
  {
    id: "crm-agent",
    name: "Pipeline Protector",
    description: "Identifies at-risk deals, stalled pipelines, and revenue opportunities",
    scope: ["crm"],
    capabilities: ["send_recovery_email", "assign_pipeline_owner", "schedule_followup"],
    confidenceThreshold: 0.7,
    requiresApproval: true,
  },
  {
    id: "operations-agent",
    name: "Process Optimizer",
    description: "Detects bottlenecks, throughput drops, and quality issues",
    scope: ["operations"],
    capabilities: ["adjust_production_rate", "schedule_quality_check", "notify_stakeholder"],
    confidenceThreshold: 0.75,
    requiresApproval: true,
  },
]

export async function getAgents(organizationId: string): Promise<AgentDefinition[]> {
  const db = createServiceClient()
  const { data: customAgents } = await db
    .from(AGENTS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("enabled", true)

  const custom = (customAgents || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    name: a.name as string,
    description: a.description as string,
    scope: a.scope as string[],
    capabilities: a.capabilities as string[],
    confidenceThreshold: a.confidence_threshold as number,
    requiresApproval: a.requires_approval as boolean,
  }))

  return [...custom, ...BUILTIN_AGENTS]
}

export async function assignFinding(
  findingId: string,
  organizationId: string,
  agentId: string,
): Promise<AgentAction | null> {
  const db = createServiceClient()
  const agents = await getAgents(organizationId)
  const agent = agents.find((a) => a.id === agentId)
  if (!agent) return null

  const { data: finding } = await db
    .from("intelligence_findings")
    .select("*")
    .eq("id", findingId)
    .eq("organization_id", organizationId)
    .single()

  if (!finding) return null

  const actionType = determineCapability(finding.type as string, agent)
  if (!actionType) return null

  const guardrail = evaluateGuardrail(
    finding.confidence,
    finding.monetary_risk ?? 0,
    actionType,
  )

  const action: AgentAction = {
    id: generateId(),
    agentId,
    type: actionType,
    input: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    targetModule: finding.source_module,
    config: { findingId, title: finding.title, suggestedAction: finding.suggested_action },
    status: guardrail === "allow" ? "approved" : "pending_approval",
    confidence: finding.confidence,
    requiresApproval: guardrail !== "allow",
  }

  await db.from(ACTIONS_TABLE).insert({
    id: action.id,
    organization_id: organizationId,
    agent_id: action.agentId,
    type: action.type,

    target_module: action.targetModule,
    config: action.config,
    status: action.status,
    confidence: action.confidence,
    requires_approval: action.requiresApproval,
  })

  await db.from("intelligence_findings").update({
    assigned_agent_id: agentId,
    suggested_action: action.type,
  }).eq("id", findingId)

  return action
}

export async function autoAssignFindings(
  organizationId: string,
): Promise<AgentAction[]> {
  const findings = await getActiveFindings(organizationId, 20)
  const actions: AgentAction[] = []

  for (const finding of findings) {
    const agent = selectAgentForFinding(finding)
    if (!agent) continue

    const action = await assignFinding(finding.id, organizationId, agent.id)
    if (action) actions.push(action)
  }

  return actions
}

export async function getPendingApprovals(
  organizationId: string,
): Promise<AgentAction[]> {
  const db = createServiceClient()
  const { data } = await db
    .from(ACTIONS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "pending_approval")
    .order("confidence", { ascending: true })
    .limit(20)

  return (data || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    agentId: a.agent_id as string,
    type: a.type as string,
    targetModule: a.target_module as string,
    config: a.config as Record<string, unknown>,
    status: a.status as AgentAction["status"],
    confidence: a.confidence as number,
    requiresApproval: a.requires_approval as boolean,
    input: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

function selectAgentForFinding(finding: IntelligenceFinding): AgentDefinition | null {
  const moduleMap: Record<string, string> = {
    compliance: "compliance-agent",
    resources: "resources-agent",
    crm: "crm-agent",
    operations: "operations-agent",
  }

  const agentId = moduleMap[finding.sourceModule]
  return BUILTIN_AGENTS.find((a) => a.id === agentId) ?? null
}

function determineCapability(
  eventType: string,
  agent: AgentDefinition,
): string | null {
  const capabilityMap: Record<string, string> = {
    "compliance.cert_expiring": "renew_certification",
    "compliance.gap_detected": "create_remediation_plan",
    "resources.low_stock": "create_purchase_order",
    "resources.maintenance_due": "schedule_maintenance",
    "crm.deal_at_risk": "send_recovery_email",
    "crm.pipeline_stalled": "assign_pipeline_owner",
    "operational.throughput_drop": "adjust_production_rate",
  }

  const capability = capabilityMap[eventType]
  if (!capability || !agent.capabilities.includes(capability)) return null
  return capability
}
