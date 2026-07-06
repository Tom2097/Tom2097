"use server"

import { createServiceClient } from "@/lib/supabase/service"

export interface DriverDecomposition {
  metric: string
  baseline: number
  current: number
  change: number
  drivers: Array<{
    name: string
    contribution: number
    direction: "positive" | "negative"
    workspace: "compliance" | "resources" | "performance" | "operations"
    correlationScore: number
    details: string
  }>
  confidence: number
  timestamp: string
}

export async function analyzeDriverDecomposition(
  organizationId: string,
  metric: string = "digit_score",
  periodDays: number = 30
): Promise<DriverDecomposition | null> {
  const supabase = await createServiceClient()

  const now = new Date()
  const periodStart = new Date(now.getTime() - periodDays * 86400000)

  const { data: scores } = await supabase
    .from("digit_scores")
    .select("overall_score, compliance_score, resources_score, performance_score, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", periodStart.toISOString())
    .order("created_at", { ascending: true })

  if (!scores || scores.length < 2) return null

  const firstScore = scores[0] as Record<string, unknown>
  const lastScore = scores[scores.length - 1] as Record<string, unknown>

  const baseline = firstScore.overall_score as number
  const current = lastScore.overall_score as number
  const change = current - baseline

  const workspaceMetrics = [
    { name: "Compliance Score", workspace: "compliance" as const, key: "compliance_score", weights: { weight: 0.4, baseline: firstScore.compliance_score as number, current: lastScore.compliance_score as number } },
    { name: "Resources Score", workspace: "resources" as const, key: "resources_score", weights: { weight: 0.3, baseline: firstScore.resources_score as number, current: lastScore.resources_score as number } },
    { name: "Performance Score", workspace: "performance" as const, key: "performance_score", weights: { weight: 0.3, baseline: firstScore.performance_score as number, current: lastScore.performance_score as number } },
  ]

  const drivers: DriverDecomposition["drivers"] = []

  for (const ws of workspaceMetrics) {
    const componentChange = (ws.weights.current - ws.weights.baseline)
    const contribution = (componentChange / (Math.abs(change) || 1)) * 100

    const sameDirection = (componentChange > 0) === (change > 0)
    const correlationScore = sameDirection
      ? Math.min(1, Math.abs(componentChange) / (Math.abs(change) + 0.01))
      : Math.max(0, 1 - Math.abs(componentChange) / (Math.abs(change) + 0.01))

    drivers.push({
      name: ws.name,
      contribution: Math.round(contribution * 10) / 10,
      direction: componentChange >= 0 ? "positive" : "negative",
      workspace: ws.workspace,
      correlationScore: Math.round(correlationScore * 100) / 100,
      details: `${ws.name} changed from ${ws.weights.baseline.toFixed(1)} to ${ws.weights.current.toFixed(1)} (${componentChange >= 0 ? "+" : ""}${componentChange.toFixed(1)})`,
    })
  }

  drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  const confidence = scores.length > 10 ? 0.85 : scores.length > 5 ? 0.7 : 0.5

  return {
    metric,
    baseline: Math.round(baseline * 10) / 10,
    current: Math.round(current * 10) / 10,
    change: Math.round(change * 10) / 10,
    drivers,
    confidence,
    timestamp: new Date().toISOString(),
  }
}

export async function getCrossWorkspaceImpact(
  organizationId: string
): Promise<Array<{ source: string; target: string; impact: number; description: string }>> {
  const supabase = await createServiceClient()

  const { data: events } = await supabase
    .from("audit_log_entries")
    .select("table_name, action, metadata, changed_at")
    .eq("organization_id", organizationId)
    .gte("changed_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("changed_at", { ascending: false })
    .limit(200)

  const eventLog = (events as Array<Record<string, unknown>>) || []
  const impacts: Array<{ source: string; target: string; impact: number; description: string }> = []

  const tableCounts = new Map<string, number>()
  for (const ev of eventLog) {
    const table = ev.table_name as string
    tableCounts.set(table, (tableCounts.get(table) || 0) + 1)
  }

  const complianceEvents = tableCounts.get("compliance_evidence") || 0
  const resourceEvents = tableCounts.get("assets") || 0
  const crmEvents = tableCounts.get("deals") || 0

  if (complianceEvents > 3) {
    impacts.push({
      source: "Compliance",
      target: "Resources",
      impact: -Math.min(15, complianceEvents * 2),
      description: `${complianceEvents} compliance events triggered resource reallocation`,
    })
  }

  if (resourceEvents > 5) {
    impacts.push({
      source: "Resources",
      target: "Performance",
      impact: -Math.min(10, resourceEvents),
      description: `Resource changes (${resourceEvents} events) affecting operational performance`,
    })
  }

  if (crmEvents > 3) {
    impacts.push({
      source: "CRM",
      target: "Performance",
      impact: Math.min(20, crmEvents * 3),
      description: `CRM deal activity (${crmEvents} events) driving revenue performance`,
    })
  }

  return impacts
}
