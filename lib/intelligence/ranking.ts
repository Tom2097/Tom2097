import type { IntelligenceFinding, ImpactScore } from "./types"

export function calculateImpactScore(finding: IntelligenceFinding): ImpactScore {
  const monetaryValue = finding.monetaryRisk ?? estimateMonetaryImpact(finding)
  const urgency = calculateUrgency(finding)
  const severity = determineSeverity(monetaryValue, urgency)
  const affectedModules = findAffectedModules(finding)
  const propagationDepth = estimatePropagationDepth(finding)

  return {
    finding,
    monetaryValue,
    urgency,
    severity,
    affectedModules,
    propagationDepth,
  }
}

function estimateMonetaryImpact(finding: IntelligenceFinding): number {
  switch (finding.type) {
    case "compliance.cert_expiring":
      return 50000
    case "compliance.gap_detected":
      return 25000
    case "resources.low_stock":
      return 10000
    case "resources.maintenance_due":
      return 15000
    case "resources.asset_offline":
      return 20000
    case "crm.deal_at_risk":
      return 75000
    case "crm.pipeline_stalled":
      return 50000
    case "performance.anomaly_detected":
      return 30000
    case "performance.threshold_breached":
      return 40000
    case "operational.bottleneck_detected":
      return 35000
    case "operational.throughput_drop":
      return 25000
    default:
      return 5000
  }
}

function calculateUrgency(finding: IntelligenceFinding): number {
  const ageHours = (Date.now() - finding.detectedAt.getTime()) / (1000 * 3600)
  const baseUrgency = finding.impactScore / 100
  const ageFactor = Math.min(ageHours / 24, 1)
  return Math.min(1, baseUrgency + ageFactor * 0.3)
}

function determineSeverity(monetaryValue: number, urgency: number): ImpactScore["severity"] {
  const composite = monetaryValue * urgency
  if (composite > 50000) return "critical"
  if (composite > 20000) return "high"
  if (composite > 5000) return "medium"
  return "low"
}

function findAffectedModules(finding: IntelligenceFinding): string[] {
  const modules = new Set<string>([finding.sourceModule])
  if (finding.causalChain) {
    for (const link of finding.causalChain) {
      modules.add(link.fromModule)
      modules.add(link.toModule)
    }
  }
  return Array.from(modules)
}

function estimatePropagationDepth(finding: IntelligenceFinding): number {
  if (!finding.causalChain || finding.causalChain.length === 0) return 0
  return finding.causalChain.length
}

export function rankFindings(findings: IntelligenceFinding[]): ImpactScore[] {
  return findings
    .map(calculateImpactScore)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return b.monetaryValue - a.monetaryValue
    })
}

export function getTopFindings(
  findings: IntelligenceFinding[],
  limit: number = 5,
): ImpactScore[] {
  return rankFindings(findings).slice(0, limit)
}
