import { computeComplianceScore } from "@/lib/compliance/scoring"
import { getCapacityUtilization } from "@/lib/resources/analytics"

export async function computeDigitScore(organizationId: string): Promise<{
  overall: number
  compliance: number
  resources: number
  performance: number
  breakdown: Record<string, number>
}> {
  const complianceResult = await computeComplianceScore(organizationId)
  const util = await getCapacityUtilization(organizationId)
  const perfScore = util.utilization_pct

  const compliance = complianceResult.overall
  const resources = util.utilization_pct
  const performance = perfScore

  const overall = Math.round((compliance * 0.4 + resources * 0.3 + performance * 0.3))

  return {
    overall,
    compliance,
    resources,
    performance,
    breakdown: {
      compliance_health: compliance,
      resource_utilization: resources,
      performance_score: performance,
    },
  }
}
