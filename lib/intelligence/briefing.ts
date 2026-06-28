import { createServiceClient } from "@/lib/supabase/service"
import { getLLM } from "@/lib/ai/client"
import { generateText } from "ai"
import type { Briefing, BriefingMetric, BriefingAction, IntelligenceFinding } from "./types"
import { getActiveFindings } from "./engine"
import { getTopFindings } from "./ranking"
import { generateId } from "@/lib/utils/id"

const BRIEFINGS_TABLE = "intelligence_briefings"

export async function generateBriefing(organizationId: string): Promise<Briefing> {
  const findings = await getActiveFindings(organizationId, 10)
  const topFindings = getTopFindings(findings, 5).map((s) => s.finding)
  const metrics = await computeBriefingMetrics(organizationId)
  const summary = await generateBriefingSummary(organizationId, topFindings, metrics)

  const actionItems: BriefingAction[] = topFindings
    .filter((f) => f.suggestedAction)
    .map((f, i) => ({
      id: `action-${i}`,
      title: f.title,
      description: f.suggestedAction ?? f.description,
      priority: f.monetaryRisk && f.monetaryRisk > 50000 ? "high" : f.monetaryRisk && f.monetaryRisk > 10000 ? "medium" : "low",
      module: f.sourceModule,
      findingId: f.id,
    }))

  const briefing: Briefing = {
    id: generateId(),
    organizationId,
    date: new Date().toISOString().split("T")[0],
    summary,
    topFindings: topFindings,
    metrics,
    actionItems,
    generatedAt: new Date(),
  }

  const db = createServiceClient()
  await db.from(BRIEFINGS_TABLE).insert({
    id: briefing.id,
    organization_id: briefing.organizationId,
    date: briefing.date,
    summary: briefing.summary,
    metrics: JSON.stringify(briefing.metrics),
    action_items: JSON.stringify(briefing.actionItems),
    generated_at: briefing.generatedAt.toISOString(),
  })

  return briefing
}

export async function getLatestBriefing(organizationId: string): Promise<Briefing | null> {
  const db = createServiceClient()
  const { data } = await db
    .from(BRIEFINGS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single()

  if (!data) return null

  const findings = await getActiveFindings(organizationId, 5)

  return {
    id: data.id,
    organizationId: data.organization_id,
    date: data.date,
    summary: data.summary,
    topFindings: findings,
    metrics: typeof data.metrics === "string" ? JSON.parse(data.metrics) : data.metrics,
    actionItems: typeof data.action_items === "string" ? JSON.parse(data.action_items) : data.action_items,
    generatedAt: new Date(data.generated_at),
  }
}

export async function getBriefingHistory(
  organizationId: string,
  limit: number = 7,
): Promise<Briefing[]> {
  const db = createServiceClient()
  const { data } = await db
    .from(BRIEFINGS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .order("generated_at", { ascending: false })
    .limit(limit)

  if (!data) return []

  const briefings: Briefing[] = []
  for (const row of data as Array<Record<string, unknown>>) {
    briefings.push({
      id: row.id as string,
      organizationId: row.organization_id as string,
      date: row.date as string,
      summary: row.summary as string,
      topFindings: [],
      metrics: typeof row.metrics === "string" ? JSON.parse(row.metrics) : (row.metrics as BriefingMetric[]),
      actionItems: typeof row.action_items === "string" ? JSON.parse(row.action_items) : (row.action_items as BriefingAction[]),
      generatedAt: new Date(row.generated_at as string),
    })
  }
  return briefings
}

async function computeBriefingMetrics(organizationId: string): Promise<BriefingMetric[]> {
  const db = createServiceClient()
  const metrics: BriefingMetric[] = []

  const { data: openDeals } = await db
    .from("deals")
    .select("value")
    .eq("organization_id", organizationId)
    .eq("status", "open")

  const totalPipeline = (openDeals || []).reduce((sum: number, d: any) => sum + (d.value || 0), 0)
  metrics.push({
    label: "Pipeline Value",
    value: totalPipeline,
    change: 0,
    trend: "stable",
  })

  const { count: activeFindings } = await db
    .from("intelligence_findings")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active")

  metrics.push({
    label: "Active Alerts",
    value: activeFindings ?? 0,
    change: 0,
    trend: activeFindings && activeFindings > 5 ? "up" : "stable",
  })

  const { count: certsExpiring } = await db
    .from("certificates")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .lte("expires_at", new Date(Date.now() + 30 * 86400000).toISOString())
    .gte("expires_at", new Date().toISOString())

  metrics.push({
    label: "Certs Expiring (30d)",
    value: certsExpiring ?? 0,
    change: 0,
    trend: certsExpiring && certsExpiring > 3 ? "up" : "stable",
  })

  const { data: recentBatches } = await db
    .from("production_batches")
    .select("throughput, expected_throughput")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("completed_at", new Date(Date.now() - 7 * 86400000).toISOString())

  const avgThroughput = recentBatches && recentBatches.length > 0
    ? recentBatches.reduce((sum: number, b: any) => sum + (b.throughput || 0), 0) / recentBatches.length
    : 0
  const avgExpected = recentBatches && recentBatches.length > 0
    ? recentBatches.reduce((sum: number, b: any) => sum + (b.expected_throughput || 0), 0) / recentBatches.length
    : 0

  metrics.push({
    label: "Avg Throughput",
    value: Math.round(avgThroughput * 100) / 100,
    change: avgExpected > 0 ? Math.round(((avgThroughput - avgExpected) / avgExpected) * 10000) / 100 : 0,
    trend: avgThroughput >= avgExpected ? "up" : "down",
  })

  return metrics
}

async function generateBriefingSummary(
  organizationId: string,
  findings: IntelligenceFinding[],
  metrics: BriefingMetric[],
): Promise<string> {
  if (!process.env.MISTRAL_API_KEY) {
    return generateFallbackSummary(findings, metrics)
  }

  try {
    const llm = getLLM()
    const findingsText = findings.map(
      (f) => `- [${f.type}] ${f.title} (risk: $${f.monetaryRisk?.toLocaleString() ?? "unknown"}, confidence: ${Math.round(f.confidence * 100)}%)`,
    ).join("\n")

    const metricsText = metrics.map(
      (m) => `- ${m.label}: ${m.value} (${m.trend})`,
    ).join("\n")

    const { text } = await generateText({
      model: llm,
      system: "You are an AI operations brain generating an executive briefing. Summarize key findings, risks, and recommended actions in 3-4 sentences. Focus on business impact.",
      prompt: `Today's Findings:\n${findingsText}\n\nMetrics:\n${metricsText}\n\nGenerate a concise executive briefing:`,
    })
    return text
  } catch {
    return generateFallbackSummary(findings, metrics)
  }
}

function generateFallbackSummary(
  findings: IntelligenceFinding[],
  metrics: BriefingMetric[],
): string {
  const criticalCount = findings.filter(
    (f) => f.monetaryRisk && f.monetaryRisk > 50000,
  ).length
  const totalRisk = findings.reduce((sum, f) => sum + (f.monetaryRisk ?? 0), 0)

  let summary = `Good morning. There are ${findings.length} active intelligence findings, ${criticalCount} of which are critical. `
  summary += `Total estimated monetary risk: $${totalRisk.toLocaleString()}. `

  const pipelineMetric = metrics.find((m) => m.label === "Pipeline Value")
  if (pipelineMetric) {
    summary += `Pipeline value stands at $${pipelineMetric.value.toLocaleString()}. `
  }

  const throughputMetric = metrics.find((m) => m.label === "Avg Throughput")
  if (throughputMetric && throughputMetric.change !== 0) {
    summary += `Throughput is ${throughputMetric.trend === "up" ? "up" : "down"} ${Math.abs(throughputMetric.change)}% vs target. `
  }

  summary += "Priority actions are listed below."

  return summary
}
