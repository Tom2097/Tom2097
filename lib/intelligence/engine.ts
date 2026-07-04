import { createServiceClient } from "@/lib/supabase/service"
import { getLLM } from "@/lib/ai/client"
import { generateText } from "ai"
export type IntelligenceEventType =
  | "compliance.cert_expiring"
  | "compliance.gap_detected"
  | "resources.low_stock"
  | "resources.maintenance_due"
  | "crm.deal_at_risk"
  | "crm.pipeline_stalled"
  | "performance.anomaly_detected"
  | "performance.threshold_breached"
  | "operational.throughput_drop"
import { computeConfidence, requiresApproval, evaluateGuardrail } from "./confidence"
import { calculateImpactScore } from "./ranking"
import { type AgentAction } from "./agents"
import { traceFromFinding } from "./causal-chain"
import { upsertEntity, relateEntities } from "./operational-graph"
import { generateId } from "@/lib/utils/id"
import type { IntelligenceFinding } from "./types"

const FINDINGS_TABLE = "intelligence_findings"
const ACTIONS_TABLE = "intelligence_actions"

export interface PerceptionInput {
  organizationId: string
  eventType: IntelligenceEventType
  sourceModule: string
  title: string
  description: string
  entityId?: string
  entityType?: string
  evidence?: Record<string, unknown>
  signalStrength?: number
}

export interface ReasonOutput {
  finding: IntelligenceFinding
  confidence: number
  monetaryRisk: number
  guardrailDecision: string
}

export async function perceive(input: PerceptionInput): Promise<ReasonOutput> {
  const confidence = computeConfidence({
    signalStrength: input.signalStrength ?? 0.8,
    dataFreshness: 0.9,
    historicalAccuracy: 0.7,
    sourceReliability: 0.8,
    patternConsistency: 0.75,
  })

  const impactScore = input.evidence?.monetaryValue as number | undefined ?? 0
  const monetaryRisk = impactScore
  const guardrailLevel = evaluateGuardrail(confidence, monetaryRisk, input.eventType)

  const finding: IntelligenceFinding = {
    id: generateId(),
    organizationId: input.organizationId,
    type: input.eventType,
    title: input.title,
    description: input.description,
    impactScore: calculateFindingImpact(monetaryRisk, confidence),
    confidence,
    status: "active",
    detectedAt: new Date(),
    sourceModule: input.sourceModule,
    entityId: input.entityId,
    monetaryRisk,
    suggestedAction: await generateSuggestedAction(input),
    requiresApproval: requiresApproval(confidence),
    evidence: input.evidence,
  }

  await persistFinding(finding)

  if (input.entityId && input.entityType) {
    await upsertEntity({
      id: input.entityId,
      organizationId: input.organizationId,
      type: input.entityType,
      name: input.title,
      status: "active",
      module: input.sourceModule,
      properties: input.evidence ?? {},
    })
  }

  return { finding, confidence, monetaryRisk, guardrailDecision: guardrailLevel }
}

export async function reason(findingId: string, organizationId: string): Promise<void> {
  const finding = await getFinding(findingId, organizationId)
  if (!finding) return

  const chain = await traceFromFinding(finding)
  if (chain) {
    const db = createServiceClient()
    await db.from(FINDINGS_TABLE).update({
      causal_chain: JSON.stringify(chain.links),
      monetary_risk: chain.totalMonetaryRisk,
    }).eq("id", findingId).eq("organization_id", organizationId)
  }
}

async function persistFinding(finding: IntelligenceFinding): Promise<void> {
  const db = createServiceClient()
  await db.from(FINDINGS_TABLE).insert({
    id: finding.id,
    organization_id: finding.organizationId,
    type: finding.type,
    title: finding.title,
    description: finding.description,
    impact_score: finding.impactScore,
    confidence: finding.confidence,
    status: finding.status,
    detected_at: finding.detectedAt.toISOString(),
    source_module: finding.sourceModule,
    entity_id: finding.entityId,
    monetary_risk: finding.monetaryRisk,
    suggested_action: finding.suggestedAction,
    requires_approval: finding.requiresApproval,
  })
}

async function getFinding(
  id: string,
  organizationId: string,
): Promise<IntelligenceFinding | null> {
  const db = createServiceClient()
  const { data } = await db
    .from(FINDINGS_TABLE)
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single()
  if (!data) return null
  return {
    id: data.id,
    organizationId: data.organization_id,
    type: data.type,
    title: data.title,
    description: data.description,
    impactScore: data.impact_score,
    confidence: data.confidence,
    status: data.status,
    detectedAt: new Date(data.detected_at),
    sourceModule: data.source_module,
    entityId: data.entity_id,
    monetaryRisk: data.monetary_risk,
    suggestedAction: data.suggested_action,
    requiresApproval: data.requires_approval,
    evidence: data.evidence as Record<string, unknown> | undefined,
  }
}

export async function act(
  findingId: string,
  organizationId: string,
): Promise<AgentAction | null> {
  const db = createServiceClient()
  const finding = await getFinding(findingId, organizationId)
  if (!finding || !finding.suggestedAction) return null

  const guardrail = evaluateGuardrail(finding.confidence ?? 0, finding.monetaryRisk ?? 0, finding.type)

  const action: AgentAction = {
    id: generateId(),
    agentId: "brain-v1",
    type: determineActionType(finding),
    input: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    targetModule: finding.sourceModule,
    config: { suggestedAction: finding.suggestedAction },
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

  return action
}

export async function approveAction(
  actionId: string,
  organizationId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from(ACTIONS_TABLE)
    .update({ status: "approved" })
    .eq("id", actionId)
    .eq("organization_id", organizationId)
  return !error
}

export async function executeAction(
  actionId: string,
  organizationId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { data: action } = await db
    .from(ACTIONS_TABLE)
    .select("*")
    .eq("id", actionId)
    .eq("organization_id", organizationId)
    .single()

  if (!action || action.status !== "approved") return false

  await db.from(ACTIONS_TABLE).update({
    status: "executing",
    executed_at: new Date().toISOString(),
  }).eq("id", actionId)

  const result = await executeActionHandler(action)

  await db.from(ACTIONS_TABLE).update({
    status: result ? "completed" : "failed",
    result: JSON.stringify({ success: result }),
  }).eq("id", actionId)

  return result
}

export async function getActiveFindings(
  organizationId: string,
  limit: number = 20,
): Promise<IntelligenceFinding[]> {
  const db = createServiceClient()
  const { data } = await db
    .from(FINDINGS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("monetary_risk", { ascending: false })
    .limit(limit)

  return (data || []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    type: f.type as string,
    title: f.title as string,
    description: f.description as string,
    monetaryRisk: f.monetary_risk as number,
    sourceModule: f.source_module as string,
    impactScore: f.impact_score as number,
    detectedAt: new Date(f.detected_at as string),
    entityId: f.entity_id as string | undefined,
    confidence: f.confidence as number | undefined,
    status: f.status as string | undefined,
    suggestedAction: f.suggested_action as string | undefined,
    requiresApproval: f.requires_approval as boolean | undefined,
    evidence: f.evidence as Record<string, unknown> | undefined,
  }))
}

function calculateFindingImpact(monetaryRisk: number, confidence: number): number {
  return Math.round(monetaryRisk * confidence * 100) / 100
}

function determineActionType(finding: IntelligenceFinding): string {
  const typeMap: Record<string, string> = {
    "compliance.cert_expiring": "renew_certification",
    "compliance.gap_detected": "create_remediation_plan",
    "resources.low_stock": "create_purchase_order",
    "resources.maintenance_due": "schedule_maintenance",
    "crm.deal_at_risk": "send_recovery_email",
    "crm.pipeline_stalled": "assign_pipeline_owner",
    "performance.anomaly_detected": "investigate_anomaly",
  }
  return typeMap[finding.type] ?? "notify_stakeholder"
}

async function generateSuggestedAction(input: PerceptionInput): Promise<string | undefined> {
  if (!process.env.MISTRAL_API_KEY) return undefined
  try {
    const llm = getLLM()
    const { text } = await generateText({
      model: llm,
      system: "You are an AI operations brain. Given an event, suggest one concrete action the system should take. Be specific and actionable. Keep it to one sentence.",
      prompt: `Event: ${input.eventType}\nTitle: ${input.title}\nDescription: ${input.description}`,
    })
    return text
  } catch {
    return undefined
  }
}

async function executeActionHandler(action: Record<string, unknown>): Promise<boolean> {
  return true
}
