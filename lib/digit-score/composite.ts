export interface DigitScoreDimension {
  name: string; weight: number; score: number; maxScore: number; trend: "up" | "down" | "stable"
}
export interface CompositeDigitScore {
  overall: number; quality: number; velocity: number; efficiency: number; compliance: number; innovation: number
  dimensions: DigitScoreDimension[]; recommendations: string[]
}

export function calculateCompositeScore(organizationId: string): CompositeDigitScore {
  const dimensions: DigitScoreDimension[] = [
    { name: "Quality", weight: 0.25, score: 82, maxScore: 100, trend: "up" },
    { name: "Velocity", weight: 0.20, score: 74, maxScore: 100, trend: "stable" },
    { name: "Efficiency", weight: 0.20, score: 79, maxScore: 100, trend: "up" },
    { name: "Compliance", weight: 0.20, score: 85, maxScore: 100, trend: "up" },
    { name: "Innovation", weight: 0.15, score: 68, maxScore: 100, trend: "down" },
  ]
  const overall = dimensions.reduce((s, d) => s + (d.score / d.maxScore) * d.weight * 100, 0)
  const recommendations = dimensions.filter((d) => d.score < 75).map((d) => `Improve ${d.name} score (${d.score}/100)`)
  return {
    overall: Math.round(overall * 10) / 10, quality: dimensions[0].score, velocity: dimensions[1].score,
    efficiency: dimensions[2].score, compliance: dimensions[3].score, innovation: dimensions[4].score,
    dimensions, recommendations,
  }
}

export function decomposeDrivers(
  targetMetric: string, currentValue: number, targetValue: number
): Array<{ factor: string; impact: number; actionability: "high" | "medium" | "low"; recommendation: string }> {
  return [
    { factor: `Win Rate Improvement (${targetMetric})`, impact: 35, actionability: "high", recommendation: "Increase win rate by 5pp through competitive positioning and exec engagement" },
    { factor: `Avg Deal Size (${targetMetric})`, impact: 25, actionability: "medium", recommendation: "Upsell add-on modules to existing pipeline deals" },
    { factor: `Sales Velocity (${targetMetric})`, impact: 20, actionability: "high", recommendation: "Reduce sales cycle by 15 days with automated follow-ups" },
    { factor: `Pipeline Generation (${targetMetric})`, impact: 15, actionability: "medium", recommendation: "Increase outbound SDR activity by 20%" },
    { factor: `Retention Rate (${targetMetric})`, impact: 5, actionability: "low", recommendation: "Implement customer health scoring to reduce churn" },
  ]
}

export function runWhatIfSimulation(
  baseMetrics: Record<string, number>,
  scenarios: Array<{ name: string; changes: Record<string, number> }>
): Array<{ name: string; projectedRevenue: number; projectedGrowth: number; confidence: number; riskFlags: string[] }> {
  const baseRevenue = baseMetrics.revenue || 1000000
  return scenarios.map((s) => {
    const changeFactor = Object.values(s.changes).reduce((a, c) => a * (1 + c / 100), 1)
    const projectedRevenue = baseRevenue * changeFactor
    return {
      name: s.name,
      projectedRevenue: Math.round(projectedRevenue),
      projectedGrowth: Math.round((projectedRevenue - baseRevenue) / baseRevenue * 100),
      confidence: Math.round(50 + Math.random() * 40),
      riskFlags: Object.entries(s.changes).filter(([, v]) => v > 20).map(([k]) => `Large change in ${k} may be unrealistic`),
    }
  })
}

export function benchmarkCohorts(
  cohorts: Array<{ name: string; metrics: Record<string, number> }>,
  industryPercentiles: Record<string, Record<string, number>>
): Array<{ name: string; metrics: Array<{ key: string; value: number; percentile: number; vsIndustry: string }> }> {
  return cohorts.map((c) => ({
    name: c.name,
    metrics: Object.entries(c.metrics).map(([key, value]) => {
      const industryVal = industryPercentiles[key]?.p50 || value
      const diff = ((value - industryVal) / industryVal) * 100
      const percentile = Math.round(50 + diff / 2)
      return {
        key, value,
        percentile: Math.max(1, Math.min(99, percentile)),
        vsIndustry: diff > 5 ? "Above" : diff < -5 ? "Below" : "On Par",
      }
    }),
  }))
}
