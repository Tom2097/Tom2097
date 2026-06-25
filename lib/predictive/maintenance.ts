interface TelemetryPoint { timestamp: Date; value: number; sensorId: string; assetId: string }
interface RULPrediction { assetId: string; currentValue: number; threshold: number; predictedRul: number; unit: string; confidence: number }

export function predictRUL(
  telemetry: TelemetryPoint[],
  threshold: number,
  degradationRate?: number
): RULPrediction {
  if (telemetry.length < 2) {
    return { assetId: telemetry[0]?.assetId || "unknown", currentValue: telemetry[0]?.value || 0, threshold, predictedRul: 999, unit: "days", confidence: 0 }
  }

  const sorted = [...telemetry].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const recentValues = sorted.slice(-10)
  const rate = degradationRate || (recentValues.length > 1
    ? (recentValues[recentValues.length - 1].value - recentValues[0].value) / recentValues.length
    : 0.1)

  const currentValue = recentValues[recentValues.length - 1].value
  const gap = threshold - currentValue
  const predictedRul = rate > 0 ? Math.max(0, gap / rate) : 999
  const confidence = Math.min(95, Math.max(20, telemetry.length * 5))

  return {
    assetId: telemetry[0].assetId,
    currentValue: Math.round(currentValue * 100) / 100,
    threshold,
    predictedRul: Math.round(predictedRul),
    unit: "days",
    confidence: Math.round(confidence),
  }
}
