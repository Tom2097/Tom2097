import { createServiceClient } from "@/lib/supabase/service"

export interface SimulationInput {
  organizationId: string
  changes: SimulationChange[]
  horizonDays: number
}

export interface SimulationChange {
  module: string
  parameter: string
  value: number
  label: string
}

export interface SimulationResult {
  id: string
  baseline: SimulationMetrics
  projected: SimulationMetrics
  delta: SimulationMetrics
  confidence: number
  risks: Array<{ module: string; impact: string; probability: number }>
  recommendations: string[]
}

export interface SimulationMetrics {
  totalRevenue: number
  operationalCost: number
  complianceScore: number
  resourceUtilization: number
  pipelineValue: number
  riskExposure: number
  throughput: number
}

export async function runSimulation(input: SimulationInput): Promise<SimulationResult> {
  const db = createServiceClient()
  const orgId = input.organizationId

  const baseline = await computeBaseline(orgId)
  const projected = await computeProjection(orgId, baseline, input.changes, input.horizonDays)
  const delta = computeDelta(baseline, projected)
  const risks = assessRisks(projected, baseline)
  const recommendations = await generateRecommendations(delta, risks)

  return {
    id: crypto.randomUUID(),
    baseline,
    projected,
    delta,
    confidence: 0.75,
    risks,
    recommendations,
  }
}

async function computeBaseline(organizationId: string): Promise<SimulationMetrics> {
  const db = createServiceClient()

  const { data: deals } = await db
    .from("deals")
    .select("value")
    .eq("organization_id", organizationId)
    .eq("status", "open")
  const pipelineValue = (deals || []).reduce((s: number, d: any) => s + (d.value || 0), 0)

  const { data: batches } = await db
    .from("production_batches")
    .select("throughput")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("completed_at", new Date(Date.now() - 30 * 86400000).toISOString())
  const avgThroughput = batches && batches.length > 0
    ? batches.reduce((s: number, b: any) => s + (b.throughput || 0), 0) / batches.length
    : 0

  const { count: certCount } = await db
    .from("certificates")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  const complianceScore = Math.min(100, ((certCount ?? 0) / Math.max(1, (certCount ?? 0) + 1)) * 100)

  const { data: items } = await db
    .from("inventory_items")
    .select("quantity")
    .eq("organization_id", organizationId)
  const totalStock = (items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0)
  const resourceUtilization = items && items.length > 0 ? Math.min(100, (totalStock / (items.length * 100)) * 100) : 50

  const { data: findings } = await db
    .from("intelligence_findings")
    .select("monetary_risk")
    .eq("organization_id", organizationId)
    .eq("status", "active")
  const riskExposure = (findings || []).reduce((s: number, f: any) => s + (f.monetary_risk || 0), 0)

  return {
    totalRevenue: pipelineValue,
    operationalCost: Math.round(pipelineValue * 0.35),
    complianceScore: Math.round(complianceScore),
    resourceUtilization: Math.round(resourceUtilization),
    pipelineValue,
    riskExposure,
    throughput: Math.round(avgThroughput * 100) / 100,
  }
}

async function computeProjection(
  organizationId: string,
  baseline: SimulationMetrics,
  changes: SimulationChange[],
  horizonDays: number,
): Promise<SimulationMetrics> {
  let revenue = baseline.totalRevenue
  let cost = baseline.operationalCost
  let compliance = baseline.complianceScore
  let utilization = baseline.resourceUtilization
  let pipeline = baseline.pipelineValue
  let risk = baseline.riskExposure
  let throughput = baseline.throughput

  for (const change of changes) {
    const impact = change.value * (horizonDays / 30)

    switch (change.module) {
      case "crm":
        if (change.parameter === "deal_value") {
          revenue += impact
          pipeline += impact
        }
        if (change.parameter === "win_rate") {
          const newDeals = baseline.pipelineValue * (change.value / 100) * 0.3
          revenue += newDeals
          pipeline += newDeals
        }
        break
      case "resources":
        if (change.parameter === "inventory") {
          utilization += impact * 0.1
          cost += impact * 0.5
        }
        if (change.parameter === "staff") {
          cost += impact * 5000
          throughput += impact * 10
        }
        break
      case "operations":
        if (change.parameter === "throughput") {
          throughput *= (1 + change.value / 100)
          revenue *= (1 + change.value / 200)
        }
        if (change.parameter === "efficiency") {
          cost *= (1 - change.value / 200)
          throughput *= (1 + change.value / 100)
        }
        break
      case "compliance":
        if (change.parameter === "certifications") {
          compliance = Math.min(100, compliance + impact * 5)
          cost += impact * 2000
          risk -= impact * 5000
        }
        break
    }
  }

  return {
    totalRevenue: Math.round(revenue),
    operationalCost: Math.round(cost),
    complianceScore: Math.round(Math.min(100, Math.max(0, compliance))),
    resourceUtilization: Math.round(Math.min(100, Math.max(0, utilization))),
    pipelineValue: Math.round(pipeline),
    riskExposure: Math.round(Math.max(0, risk)),
    throughput: Math.round(throughput * 100) / 100,
  }
}

function computeDelta(baseline: SimulationMetrics, projected: SimulationMetrics): SimulationMetrics {
  return {
    totalRevenue: projected.totalRevenue - baseline.totalRevenue,
    operationalCost: projected.operationalCost - baseline.operationalCost,
    complianceScore: projected.complianceScore - baseline.complianceScore,
    resourceUtilization: projected.resourceUtilization - baseline.resourceUtilization,
    pipelineValue: projected.pipelineValue - baseline.pipelineValue,
    riskExposure: projected.riskExposure - baseline.riskExposure,
    throughput: Math.round((projected.throughput - baseline.throughput) * 100) / 100,
  }
}

function assessRisks(
  projected: SimulationMetrics,
  baseline: SimulationMetrics,
): Array<{ module: string; impact: string; probability: number }> {
  const risks: Array<{ module: string; impact: string; probability: number }> = []

  if (projected.riskExposure > baseline.riskExposure * 1.2) {
    risks.push({ module: "compliance", impact: "Increased risk exposure may trigger audit issues", probability: 0.65 })
  }
  if (projected.operationalCost > baseline.operationalCost * 1.3) {
    risks.push({ module: "resources", impact: "Cost overruns may impact margins", probability: 0.55 })
  }
  if (projected.resourceUtilization > 95) {
    risks.push({ module: "resources", impact: "Resource capacity constraints likely", probability: 0.75 })
  }
  if (projected.complianceScore < 60) {
    risks.push({ module: "compliance", impact: "Compliance score below threshold", probability: 0.8 })
  }
  if (projected.throughput < baseline.throughput * 0.8) {
    risks.push({ module: "operations", impact: "Throughput drop may delay deliveries", probability: 0.7 })
  }

  return risks
}

async function generateRecommendations(
  delta: SimulationMetrics,
  risks: Array<{ module: string; impact: string; probability: number }>,
): Promise<string[]> {
  const recommendations: string[] = []

  if (delta.totalRevenue < 0) {
    recommendations.push("Consider increasing sales capacity or adjusting pricing to offset projected revenue decline")
  }
  if (delta.operationalCost > 0 && delta.operationalCost > delta.totalRevenue * 0.1) {
    recommendations.push("Cost growth outpaces revenue — review resource allocation and identify efficiency gains")
  }
  if (delta.complianceScore < -10) {
    recommendations.push("Compliance score is projected to drop — preemptively schedule audits and renewals")
  }
  if (delta.resourceUtilization > 10) {
    recommendations.push("Resource utilization rising — plan capacity expansion to avoid bottlenecks")
  }
  if (delta.riskExposure > 0) {
    recommendations.push("Risk exposure increasing — review active findings and resolve high-impact items first")
  }

  for (const risk of risks) {
    if (risk.probability > 0.7) {
      recommendations.push(`High probability: ${risk.impact}`)
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Projected outcomes are stable — continue current strategy")
  }

  return recommendations
}
