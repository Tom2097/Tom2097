import { createServiceClient } from "@/lib/supabase/service"

export interface BenchmarkConfig {
  cohortSize: number
  kAnonymityThreshold: number
  epsilon: number
  metrics: string[]
  dimensions: string[]
}

export interface BenchmarkResult {
  cohort: string
  metric: string
  value: number
  percentile25: number
  percentile50: number
  percentile75: number
  sampleSize: number
  anonymized: boolean
}

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  cohortSize: 10,
  kAnonymityThreshold: 5,
  epsilon: 1.0,
  metrics: ["compliance_score", "resource_utilization", "ai_actions", "document_count"],
  dimensions: ["industry", "size", "region"],
}

function addLaplaceNoise(value: number, epsilon: number, sensitivity: number = 1): number {
  const scale = sensitivity / epsilon
  const u = Math.random() - 0.5
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
  return Math.round((value + noise) * 100) / 100
}

function satisfiesKAnonymity(sampleSize: number, threshold: number): boolean {
  return sampleSize >= threshold
}

export async function computeBenchmark(
  organizationId: string,
  dimension: string,
  metric: string,
  epsilon: number = DEFAULT_BENCHMARK_CONFIG.epsilon
): Promise<BenchmarkResult> {
  if (!organizationId || !dimension || !metric) {
    throw new Error("Missing required parameters: organizationId, dimension, or metric")
  }
  
  const supabase = await createServiceClient()

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("industry, size, region")
    .eq("id", organizationId)
    .single()

  if (orgError || !org) {
    throw new Error(`Organization not found: ${organizationId}`)
  }

  const orgRow = org as unknown as Record<string, string | null>
  const dimensionValue = dimension === "size" ? orgRow.size : dimension === "region" ? orgRow.region : orgRow.industry
  if (!dimensionValue) {
    throw new Error(`Dimension value not found for: ${dimension}`)
  }

  const { data: peers, error: peersError } = await supabase
    .from("organizations")
    .select("id")
    .eq(dimension, dimensionValue)
    .neq("id", organizationId)

  if (peersError) {
    throw new Error(`Failed to fetch peers: ${peersError.message}`)
  }

  const peerIds = (peers || []).map(p => p.id)
  const cohortSize = peerIds.length + 1

  const anonymized = !satisfiesKAnonymity(cohortSize, DEFAULT_BENCHMARK_CONFIG.kAnonymityThreshold)

  let metricValues: number[] = []

  const { data: scores } = await supabase
    .from("digit_scores")
    .select("score, organization_id")
    .in("organization_id", [organizationId, ...peerIds])
    .eq("metric", metric)
  
  if (!scores || scores.length === 0) {
    const { data: fallbackScores } = await supabase
      .from("digit_scores")
      .select("score")
      .eq("organization_id", organizationId)
      .eq("metric", metric)
      .single()
    
    if (!fallbackScores) {
      throw new Error(`No data available for metric: ${metric}`)
    }
    
    metricValues = [fallbackScores.score]
  } else {
    metricValues = scores.map(s => s.score)
  }

  if (metricValues.length === 0) {
    return {
      cohort: dimensionValue || "unknown",
      metric,
      value: 0,
      percentile25: 0,
      percentile50: 0,
      percentile75: 0,
      sampleSize: 0,
      anonymized: true
    }
  }

  metricValues.sort((a, b) => a - b)

  const selfValue = metricValues[0]
  const p25 = metricValues[Math.floor(metricValues.length * 0.25)]
  const p50 = metricValues[Math.floor(metricValues.length * 0.5)]
  const p75 = metricValues[Math.floor(metricValues.length * 0.75)]

  const finalValue = anonymized ? addLaplaceNoise(selfValue, epsilon) : selfValue

  return {
    cohort: dimensionValue,
    metric,
    value: finalValue,
    percentile25: p25,
    percentile50: p50,
    percentile75: p75,
    sampleSize: cohortSize,
    anonymized,
  }
}

export async function getPeerComparison(
  organizationId: string
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  for (const metric of DEFAULT_BENCHMARK_CONFIG.metrics) {
    const result = await computeBenchmark(organizationId, "industry", metric)
    if (result) results.push(result)
  }

  return results
}
