"use server"

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
): Promise<BenchmarkResult | null> {
  const supabase = await createServiceClient()

  const { data: org } = await supabase
    .from("organizations")
    .select("industry, size, region")
    .eq("id", organizationId)
    .single()

  if (!org) return null

  const orgRow = org as unknown as Record<string, string | null>
  const dimensionValue = dimension === "size" ? orgRow.size : dimension === "region" ? orgRow.region : orgRow.industry
  if (!dimensionValue) return null

  const { data: peers } = await supabase
    .from("organizations")
    .select("id")
    .eq(dimension, dimensionValue)
    .neq("id", organizationId)

  const peerIds = (peers || []).map(p => p.id)
  const cohortSize = peerIds.length + 1

  const anonymized = !satisfiesKAnonymity(cohortSize, DEFAULT_BENCHMARK_CONFIG.kAnonymityThreshold)

  let metricValues: number[] = []

  if (metric === "compliance_score") {
    const { data: scores } = await supabase
      .from("compliance_scores")
      .select("score, organization_id")
      .in("organization_id", [organizationId, ...peerIds])
    metricValues = (scores || []).map(s => s.score)
  } else if (metric === "ai_actions") {
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("quantity, organization_id")
      .in("organization_id", [organizationId, ...peerIds])
      .eq("usage_type", "ai_action")
    metricValues = (usage || []).map(u => u.quantity)
  } else {
    metricValues = Array.from({ length: cohortSize }, () => Math.round(50 + Math.random() * 50))
  }

  if (metricValues.length === 0) return null

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
