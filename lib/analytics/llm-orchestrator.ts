export interface AnalyticalJob {
  id: string
  type: "anomaly_detection" | "forecasting" | "causal_analysis" | "benchmarking" | "scoring" | "report" | "simulation"
  params: Record<string, unknown>
  priority: number
  dependsOn?: string[]
}

export interface OrchestrationPlan {
  jobs: AnalyticalJob[]
  estimatedDuration: string
  description: string
}

export async function createOrchestrationPlan(
  userIntent: string,
  context: { workspace?: string; timeRange?: string; metrics?: string[] }
): Promise<OrchestrationPlan> {
  // Parse user intent and determine which analytical jobs to run
  const intent = userIntent.toLowerCase()
  const jobs: AnalyticalJob[] = []
  
  if (intent.includes("anomaly") || intent.includes("unusual") || intent.includes("outlier")) {
    jobs.push({ id: "anomaly-1", type: "anomaly_detection", params: { metrics: context.metrics || [], timeRange: context.timeRange || "7d" }, priority: 1 })
  }
  
  if (intent.includes("forecast") || intent.includes("predict") || intent.includes("trend") || intent.includes("future")) {
    jobs.push({ id: "forecast-1", type: "forecasting", params: { metrics: context.metrics || ["overall_score"], horizon: "30d" }, priority: 2, dependsOn: ["anomaly-1"] })
  }
  
  if (intent.includes("why") || intent.includes("cause") || intent.includes("root") || intent.includes("impact")) {
    jobs.push({ id: "causal-1", type: "causal_analysis", params: { metric: context.metrics?.[0] || "digit_score" }, priority: 1 })
    jobs.push({ id: "sim-1", type: "simulation", params: { scenario: userIntent }, priority: 3, dependsOn: ["causal-1"] })
  }
  
  if (intent.includes("benchmark") || intent.includes("compare") || intent.includes("peer")) {
    jobs.push({ id: "bench-1", type: "benchmarking", params: { dimension: "industry" }, priority: 2 })
  }
  
  if (intent.includes("score") || intent.includes("health") || intent.includes("overall")) {
    jobs.push({ id: "score-1", type: "scoring", params: { includeBreakdown: true }, priority: 1 })
  }
  
  if (intent.includes("report") || intent.includes("brief") || intent.includes("summary")) {
    jobs.push({ id: "report-1", type: "report", params: { format: "narrative", includeCharts: true }, priority: 4, dependsOn: jobs.map(j => j.id) })
  }

  // If no specific intent detected, run standard health check
  if (jobs.length === 0) {
    jobs.push(
      { id: "score-1", type: "scoring", params: {}, priority: 1 },
      { id: "anomaly-1", type: "anomaly_detection", params: { timeRange: "24h" }, priority: 2, dependsOn: ["score-1"] },
      { id: "report-1", type: "report", params: { format: "brief" }, priority: 3, dependsOn: ["anomaly-1"] }
    )
  }

  return {
    jobs,
    estimatedDuration: `${jobs.length * 2}s`,
    description: `Running ${jobs.length} analytical job(s) based on: "${userIntent}"`,
  }
}
