import type { ConfidenceThreshold } from "./types"
import { CONFIDENCE_THRESHOLDS } from "./types"

export function getConfidenceLevel(score: number): ConfidenceThreshold {
  for (const threshold of CONFIDENCE_THRESHOLDS) {
    if (score >= threshold.minConfidence) return threshold
  }
  return CONFIDENCE_THRESHOLDS[CONFIDENCE_THRESHOLDS.length - 1]
}

export function requiresApproval(confidence: number): boolean {
  return getConfidenceLevel(confidence).level !== "auto"
}

export function getActionLabel(confidence: number): string {
  return getConfidenceLevel(confidence).description
}

export function computeConfidence(
  factors: {
    signalStrength: number
    dataFreshness: number
    historicalAccuracy: number
    sourceReliability: number
    patternConsistency: number
  },
): number {
  const weights = {
    signalStrength: 0.25,
    dataFreshness: 0.15,
    historicalAccuracy: 0.25,
    sourceReliability: 0.15,
    patternConsistency: 0.20,
  }

  const score =
    factors.signalStrength * weights.signalStrength +
    factors.dataFreshness * weights.dataFreshness +
    factors.historicalAccuracy * weights.historicalAccuracy +
    factors.sourceReliability * weights.sourceReliability +
    factors.patternConsistency * weights.patternConsistency

  return Math.max(0, Math.min(1, score))
}

export function computeMonetaryRisk(
  impact: number,
  probability: number,
  propagationFactor: number = 1,
): number {
  return Math.round(impact * probability * propagationFactor * 100) / 100
}

export type GuardrailDecision = "allow" | "ask" | "block"

export function evaluateGuardrail(
  confidence: number,
  monetaryRisk: number,
  actionType: string,
): GuardrailDecision {
  if (confidence >= 0.9 && monetaryRisk < 10000) return "allow"
  if (confidence >= 0.7 && monetaryRisk < 50000) return "ask"
  if (confidence >= 0.4 || monetaryRisk < 100000) return "ask"
  return "block"
}
