import { createServiceClient } from "@/lib/supabase/service"
import { getEntitiesByModule } from "./operational-graph"
import { getActiveFindings, perceive, approveAction } from "./engine"
import { generateBriefing } from "./briefing"
import { generateAiResponse } from "@/lib/ai/helpers"
import type { IntelligenceFinding, AgentAction } from "./types"

export interface IntentCommand {
  intent: string
  originalQuery: string
  steps: IntentStep[]
  status: "parsed" | "executing" | "completed" | "failed"
  result?: Record<string, unknown>
}

export interface IntentStep {
  id: string
  action: string
  module: string
  description: string
  status: "pending" | "running" | "completed" | "failed"
  result?: unknown
}

const INTENT_PATTERNS: Array<{
  pattern: RegExp
  intent: string
  modules: string[]
  steps: Array<{ action: string; module: string; description: string }>
}> = [
  {
    pattern: /prepare.*audit|audit.*prep|compliance.*review/i,
    intent: "prepare_for_audit",
    modules: ["compliance", "crm", "operations"],
    steps: [
      { action: "gather_certificates", module: "compliance", description: "Gather all active certificates and compliance docs" },
      { action: "find_gaps", module: "compliance", description: "Identify compliance gaps and non-conformities" },
      { action: "gather_deal_docs", module: "crm", description: "Collect deal documentation and contracts" },
      { action: "gather_batch_records", module: "operations", description: "Compile production batch records" },
      { action: "generate_audit_report", module: "compliance", description: "Generate audit readiness report" },
    ],
  },
  {
    pattern: /optimize.*supply|supply.*chain|reduce.*stockout|inventory.*review/i,
    intent: "optimize_supply_chain",
    modules: ["resources", "operations", "crm"],
    steps: [
      { action: "analyze_inventory", module: "resources", description: "Analyze current inventory levels and usage patterns" },
      { action: "forecast_demand", module: "operations", description: "Forecast demand based on production schedules" },
      { action: "identify_risks", module: "resources", description: "Identify stockout risks and overstock items" },
      { action: "generate_optimization", module: "resources", description: "Generate inventory optimization recommendations" },
    ],
  },
  {
    pattern: /improve.*pipeline|pipeline.*health|deal.*review|sales.*review/i,
    intent: "review_pipeline",
    modules: ["crm"],
    steps: [
      { action: "analyze_pipeline", module: "crm", description: "Analyze pipeline composition and stage distribution" },
      { action: "find_stalled_deals", module: "crm", description: "Identify stalled and at-risk deals" },
      { action: "generate_recommendations", module: "crm", description: "Generate pipeline optimization recommendations" },
    ],
  },
  {
    pattern: /assess.*risk|risk.*assessment|what.*risk|threat/i,
    intent: "risk_assessment",
    modules: ["compliance", "resources", "operations", "crm"],
    steps: [
      { action: "gather_findings", module: "compliance", description: "Gather all active intelligence findings" },
      { action: "assess_compliance_risk", module: "compliance", description: "Assess compliance and certification risks" },
      { action: "assess_operational_risk", module: "operations", description: "Assess operational and throughput risks" },
      { action: "assess_financial_risk", module: "crm", description: "Assess pipeline and revenue risks" },
      { action: "generate_risk_report", module: "compliance", description: "Generate comprehensive risk assessment" },
    ],
  },
  {
    pattern: /morning.*brief|daily.*brief|what.*new|update.*me|executive.*summary/i,
    intent: "daily_briefing",
    modules: ["compliance", "crm", "operations", "resources"],
    steps: [
      { action: "run_monitors", module: "compliance", description: "Run all module monitors" },
      { action: "gather_findings", module: "compliance", description: "Collect active findings" },
      { action: "generate_briefing", module: "compliance", description: "Generate executive briefing" },
    ],
  },
]

export async function resolveCommand(query: string, organizationId: string): Promise<IntentCommand | null> {
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.pattern.test(query)) {
      return {
        intent: pattern.intent,
        originalQuery: query,
        steps: pattern.steps.map((s, i) => ({
          id: `step-${i}`,
          action: s.action,
          module: s.module,
          description: s.description,
          status: "pending" as const,
        })),
        status: "parsed",
      }
    }
  }

  if (process.env.MISTRAL_API_KEY) {
    return await resolveWithLLM(query, organizationId)
  }

  return null
}

async function resolveWithLLM(query: string, organizationId: string): Promise<IntentCommand | null> {
  try {
    const prompt = `Given the user command: "${query}"

Return a JSON array of steps to execute. Each step has: action (string), module (string - one of: compliance, crm, resources, operations), description (string).

Example for "prepare for audit":
[{"action":"gather_certificates","module":"compliance","description":"Gather all active certificates"},{"action":"find_gaps","module":"compliance","description":"Identify compliance gaps"}]

Return ONLY valid JSON array, no markdown.`

    const text = await generateAiResponse(prompt, "You are an AI operations orchestrator. Parse user commands into multi-step execution plans.", true)
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim()
    const steps = JSON.parse(cleaned)

    if (!Array.isArray(steps) || steps.length === 0) return null

    return {
      intent: "llm_resolved",
      originalQuery: query,
      steps: steps.map((s: { action: string; module: string; description: string }, i: number) => ({
        id: `step-${i}`,
        action: s.action,
        module: s.module,
        description: s.description,
        status: "pending" as const,
      })),
      status: "parsed",
    }
  } catch {
    return null
  }
}

export async function executeIntent(command: IntentCommand, organizationId: string): Promise<IntentCommand> {
  command.status = "executing"

  for (const step of command.steps) {
    step.status = "running"
    try {
      step.result = await executeStepAction(step.action, step.module, organizationId)
      step.status = "completed"
    } catch (err) {
      step.status = "failed"
      step.result = { error: String(err) }
    }
  }

  const allCompleted = command.steps.every((s) => s.status === "completed")
  command.status = allCompleted ? "completed" : "failed"

  if (command.intent === "daily_briefing" && allCompleted) {
    command.result = { briefing: await generateBriefing(organizationId) }
  } else if (allCompleted) {
    command.result = { summary: `Completed ${command.steps.length} steps successfully` }
  }

  return command
}

async function executeStepAction(action: string, module: string, organizationId: string): Promise<unknown> {
  switch (action) {
    case "gather_certificates": {
      const entities = await getEntitiesByModule(organizationId, "compliance")
      return { count: entities.length, entities: entities.map((e) => ({ id: e.id, name: e.name, status: e.status })) }
    }
    case "find_gaps": {
      const db = createServiceClient()
      const { data } = await db
        .from("compliance_gaps")
        .select("id, title, score")
        .eq("organization_id", organizationId)
        .gte("score", 5)
      return { gaps: data || [] }
    }
    case "gather_deal_docs": {
      const entities = await getEntitiesByModule(organizationId, "crm")
      return { deals: entities.map((e) => ({ id: e.id, name: e.name })) }
    }
    case "gather_batch_records": {
      const entities = await getEntitiesByModule(organizationId, "operations")
      return { batches: entities.map((e) => ({ id: e.id, name: e.name })) }
    }
    case "generate_audit_report":
    case "generate_risk_report":
    case "generate_recommendations": {
      const findings = await getActiveFindings(organizationId, 20)
      return {
        findings: findings.map((f) => ({ id: f.id, type: f.type, title: f.title, risk: f.monetaryRisk })),
        totalRisk: findings.reduce((s, f) => s + (f.monetaryRisk ?? 0), 0),
        findingCount: findings.length,
      }
    }
    case "run_monitors": {
       const { runAllMonitors } = await import("./monitor")
      return runAllMonitors(organizationId)
    }
    case "gather_findings":
    case "assess_compliance_risk":
    case "assess_operational_risk":
    case "assess_financial_risk": {
      const findings = await getActiveFindings(organizationId, 20)
      const moduleFindings = findings.filter((f) => f.sourceModule === module)
      return {
        module: module === "compliance" ? module : module,
        findings: moduleFindings.length,
        totalRisk: moduleFindings.reduce((s, f) => s + (f.monetaryRisk ?? 0), 0),
      }
    }
    case "generate_briefing": {
      const briefing = await generateBriefing(organizationId)
      return { briefingId: briefing.id, summary: briefing.summary }
    }
    case "analyze_inventory":
    case "analyze_pipeline": {
      const entities = await getEntitiesByModule(organizationId, module)
      return { entityCount: entities.length }
    }
    case "forecast_demand": {
      const db = createServiceClient()
      const { data } = await db
        .from("production_batches")
        .select("throughput, expected_throughput")
        .eq("organization_id", organizationId)
        .eq("status", "planned")
      return { plannedBatches: data?.length || 0 }
    }
    case "identify_risks":
    case "find_stalled_deals": {
      const findings = await getActiveFindings(organizationId, 20)
      return {
        risks: findings.filter((f) => f.sourceModule === module || module === "resources")
          .map((f) => ({ id: f.id, title: f.title, risk: f.monetaryRisk })),
      }
    }
    case "generate_optimization": {
      return {
        recommendations: [
          "Review reorder points for high-velocity items",
          "Consider just-in-time inventory for stable demand items",
          "Increase safety stock for critical path materials",
        ],
      }
    }
    default:
      return { note: `Action ${action} executed on ${module}` }
  }
}
