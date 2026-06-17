import { createServiceClient } from "@/lib/supabase/service"
import { generateText } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import type { TimeseriesPoint } from "./types"

/**
 * Module #7.3: Statistical Anomaly Detection.
 * 
 * Provides multiple anomaly detection algorithms for identifying unusual
 * patterns in analytics data. Supports both statistical methods and
 * AI-powered detection for complex patterns.
 */

// Anomaly detection methods
export type AnomalyDetectionMethod = 
  | "zscore"
  | "iqr"
  | "mad"
  | "rolling_avg"
  | "seasonal_decomposition"
  | "ai"

// Anomaly severity levels
export type AnomalySeverity = "critical" | "high" | "medium" | "low"

// Anomaly types
export type AnomalyType = 
  | "spike"
  | "drop"
  | "outlier"
  | "seasonal_anomaly"
  | "trend_break"
  | "cluster_anomaly"
  | "contextual_anomaly"

export interface DetectedAnomaly {
  id: string
  timestamp: string
  bucket: string
  value: number
  expectedValue: number
  deviation: number
  deviationPercentage: number
  method: AnomalyDetectionMethod
  type: AnomalyType
  severity: AnomalySeverity
  confidence: number // 0-100
  metric: string
  dimension?: string
  dimensionValue?: string
  context: {
    mean: number
    stdDev: number
    min: number
    max: number
    median: number
  }
  previousValues: TimeseriesPoint[]
  nextValues: TimeseriesPoint[]
}

export interface AnomalyDetectionOptions {
  /** Method(s) to use for detection */
  methods?: AnomalyDetectionMethod[]
  /** Sensitivity multiplier (higher = more anomalies detected) */
  sensitivity?: number
  /** Minimum confidence threshold (0-100) */
  minConfidence?: number
  /** Minimum number of data points required */
  minDataPoints?: number
  /** Whether to use AI for complex pattern detection */
  useAI?: boolean
  /** Lookback window for rolling calculations */
  rollingWindow?: number
  /** Seasonality period in days (for seasonal decomposition) */
  seasonalityPeriod?: number
}

const DEFAULT_OPTIONS: Required<AnomalyDetectionOptions> = {
  methods: ["zscore", "iqr", "rolling_avg"],
  sensitivity: 2.5,
  minConfidence: 70,
  minDataPoints: 10,
  useAI: true,
  rollingWindow: 7,
  seasonalityPeriod: 7,
}

/**
 * Calculate basic statistics for a dataset
 */
function calculateStatistics(values: number[]): {
  mean: number
  stdDev: number
  min: number
  max: number
  median: number
  q1: number
  q3: number
  iqr: number
  mad: number
} {
  if (values.length === 0) {
    return {
      mean: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      median: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      mad: 0,
    }
  }

  // Sort values
  const sorted = [...values].sort((a, b) => a - b)

  // Mean
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length

  // Standard deviation
  const variance = sorted.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / sorted.length
  const stdDev = Math.sqrt(variance)

  // Min and max
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  // Median
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 !== 0 
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2

  // Quartiles
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1

  // Median Absolute Deviation (MAD)
  const absDeviations = sorted.map(v => Math.abs(v - median))
  const mad = calculateStatistics(absDeviations).median

  return {
    mean,
    stdDev,
    min,
    max,
    median,
    q1,
    q3,
    iqr,
    mad,
  }
}

/**
 * Detect anomalies using Z-score method
 * Z-score > threshold indicates an anomaly
 */
function detectZScoreAnomalies(
  points: TimeseriesPoint[],
  metric: string,
  sensitivity: number = 2.5
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  if (points.length < 3) return anomalies

  const values = points.map(p => p.value)
  const stats = calculateStatistics(values)

  const threshold = sensitivity

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const zScore = Math.abs((point.value - stats.mean) / (stats.stdDev || 1))

    if (zScore > threshold) {
      const isSpike = point.value > stats.mean + stats.stdDev * threshold
      const isDrop = point.value < stats.mean - stats.stdDev * threshold

      const anomaly: DetectedAnomaly = {
        id: `zscore_${metric}_${point.bucket}`,
        timestamp: new Date(point.bucket).toISOString(),
        bucket: point.bucket,
        value: point.value,
        expectedValue: stats.mean,
        deviation: point.value - stats.mean,
        deviationPercentage: ((point.value - stats.mean) / Math.abs(stats.mean || 1)) * 100,
        method: "zscore",
        type: isSpike ? "spike" : isDrop ? "drop" : "outlier",
        severity: zScore > 4 ? "critical" : zScore > 3 ? "high" : zScore > 2.5 ? "medium" : "low",
        confidence: Math.min(80 + zScore * 5, 100),
        metric,
        context: stats,
        previousValues: points.slice(Math.max(0, i - 2), i),
        nextValues: points.slice(i + 1, Math.min(points.length, i + 3)),
      }
      anomalies.push(anomaly)
    }
  }

  return anomalies
}

/**
 * Detect anomalies using Interquartile Range (IQR) method
 * Values outside Q1 - 1.5*IQR or Q3 + 1.5*IQR are anomalies
 */
function detectIQRAnomalies(
  points: TimeseriesPoint[],
  metric: string,
  sensitivity: number = 1.5
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  if (points.length < 3) return anomalies

  const values = points.map(p => p.value)
  const stats = calculateStatistics(values)

  const lowerBound = stats.q1 - sensitivity * stats.iqr
  const upperBound = stats.q3 + sensitivity * stats.iqr

  for (let i = 0; i < points.length; i++) {
    const point = points[i]

    if (point.value < lowerBound || point.value > upperBound) {
      const isSpike = point.value > upperBound
      const isDrop = point.value < lowerBound

      const anomaly: DetectedAnomaly = {
        id: `iqr_${metric}_${point.bucket}`,
        timestamp: new Date(point.bucket).toISOString(),
        bucket: point.bucket,
        value: point.value,
        expectedValue: stats.median,
        deviation: point.value - stats.median,
        deviationPercentage: ((point.value - stats.median) / Math.abs(stats.median || 1)) * 100,
        method: "iqr",
        type: isSpike ? "spike" : isDrop ? "drop" : "outlier",
        severity: point.value < lowerBound - stats.iqr || point.value > upperBound + stats.iqr 
          ? "high" 
          : "medium",
        confidence: Math.min(75 + (Math.abs(point.value - stats.median) / stats.iqr) * 10, 100),
        metric,
        context: stats,
        previousValues: points.slice(Math.max(0, i - 2), i),
        nextValues: points.slice(i + 1, Math.min(points.length, i + 3)),
      }
      anomalies.push(anomaly)
    }
  }

  return anomalies
}

/**
 * Detect anomalies using Median Absolute Deviation (MAD) method
 * More robust to outliers than Z-score
 */
function detectMADAnomalies(
  points: TimeseriesPoint[],
  metric: string,
  sensitivity: number = 3
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  if (points.length < 3) return anomalies

  const values = points.map(p => p.value)
  const stats = calculateStatistics(values)

  const threshold = sensitivity

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const modifiedZScore = 0.6745 * (point.value - stats.median) / (stats.mad || 0.001)

    if (Math.abs(modifiedZScore) > threshold) {
      const isSpike = modifiedZScore > 0
      const isDrop = modifiedZScore < 0

      const anomaly: DetectedAnomaly = {
        id: `mad_${metric}_${point.bucket}`,
        timestamp: new Date(point.bucket).toISOString(),
        bucket: point.bucket,
        value: point.value,
        expectedValue: stats.median,
        deviation: point.value - stats.median,
        deviationPercentage: ((point.value - stats.median) / Math.abs(stats.median || 1)) * 100,
        method: "mad",
        type: isSpike ? "spike" : isDrop ? "drop" : "outlier",
        severity: Math.abs(modifiedZScore) > 5 ? "critical" : Math.abs(modifiedZScore) > 4 ? "high" : "medium",
        confidence: Math.min(75 + Math.abs(modifiedZScore) * 8, 100),
        metric,
        context: stats,
        previousValues: points.slice(Math.max(0, i - 2), i),
        nextValues: points.slice(i + 1, Math.min(points.length, i + 3)),
      }
      anomalies.push(anomaly)
    }
  }

  return anomalies
}

/**
 * Detect anomalies using rolling average method
 * Compares each point to the rolling average of previous points
 */
function detectRollingAvgAnomalies(
  points: TimeseriesPoint[],
  metric: string,
  window: number = 7,
  sensitivity: number = 2
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  if (points.length < window + 1) return anomalies

  for (let i = window; i < points.length; i++) {
    const point = points[i]
    const previousPoints = points.slice(i - window, i)
    const previousValues = previousPoints.map(p => p.value)

    const rollingAvg = previousValues.reduce((a, b) => a + b, 0) / previousValues.length
    const rollingStdDev = Math.sqrt(
      previousValues.reduce((sq, n) => sq + Math.pow(n - rollingAvg, 2), 0) / previousValues.length
    )

    const zScore = Math.abs((point.value - rollingAvg) / (rollingStdDev || 1))

    if (zScore > sensitivity) {
      const isSpike = point.value > rollingAvg + rollingStdDev * sensitivity
      const isDrop = point.value < rollingAvg - rollingStdDev * sensitivity

      const anomaly: DetectedAnomaly = {
        id: `rolling_${metric}_${point.bucket}`,
        timestamp: new Date(point.bucket).toISOString(),
        bucket: point.bucket,
        value: point.value,
        expectedValue: rollingAvg,
        deviation: point.value - rollingAvg,
        deviationPercentage: ((point.value - rollingAvg) / Math.abs(rollingAvg || 1)) * 100,
        method: "rolling_avg",
        type: isSpike ? "spike" : isDrop ? "drop" : "outlier",
        severity: zScore > 4 ? "critical" : zScore > 3 ? "high" : "medium",
        confidence: Math.min(70 + zScore * 8, 100),
        metric,
        context: {
          mean: rollingAvg,
          stdDev: rollingStdDev,
          min: Math.min(...previousValues),
          max: Math.max(...previousValues),
          median: calculateStatistics(previousValues).median,
        },
        previousValues: points.slice(i - window, i),
        nextValues: points.slice(i + 1, Math.min(points.length, i + 3)),
      }
      anomalies.push(anomaly)
    }
  }

  return anomalies
}

/**
 * Detect seasonal anomalies by comparing to historical patterns
 */
async function detectSeasonalAnomalies(
  organizationId: string,
  metric: string,
  points: TimeseriesPoint[],
  seasonalityPeriod: number = 7
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []

  if (points.length < seasonalityPeriod * 2) return anomalies

  try {
    const db = createServiceClient()

    // Get historical data for the same periods
    const historicalData = await db.rpc("analytics_event_timeseries", {
      p_org: organizationId,
      p_event: metric,
      p_category: "",
      p_start: new Date(Date.now() - seasonalityPeriod * 24 * 60 * 60 * 1000 * 10).toISOString(),
      p_end: points[0].bucket,
      p_granularity: "day",
      p_agg: "count",
    })

    if (historicalData.error) {
      console.error("[Anomaly Detection] Error fetching historical data:", historicalData.error.message)
      return anomalies
    }

    const historicalPoints = (historicalData.data ?? []) as { bucket: string; value: number }[]

    // Group by day of week for weekly seasonality
    const dayOfWeekValues: Record<number, number[]> = {}
    
    for (const point of historicalPoints) {
      const date = new Date(point.bucket)
      const dayOfWeek = date.getDay()
      if (!dayOfWeekValues[dayOfWeek]) {
        dayOfWeekValues[dayOfWeek] = []
      }
      dayOfWeekValues[dayOfWeek].push(point.value)
    }

    // Calculate expected values based on day of week
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const date = new Date(point.bucket)
      const dayOfWeek = date.getDay()

      const historicalValues = dayOfWeekValues[dayOfWeek] || []
      
      if (historicalValues.length < 3) continue

      const stats = calculateStatistics(historicalValues)
      const zScore = Math.abs((point.value - stats.mean) / (stats.stdDev || 1))

      if (zScore > 2.5) {
        const anomaly: DetectedAnomaly = {
          id: `seasonal_${metric}_${point.bucket}`,
          timestamp: new Date(point.bucket).toISOString(),
          bucket: point.bucket,
          value: point.value,
          expectedValue: stats.mean,
          deviation: point.value - stats.mean,
          deviationPercentage: ((point.value - stats.mean) / Math.abs(stats.mean || 1)) * 100,
          method: "seasonal_decomposition",
          type: "seasonal_anomaly",
          severity: zScore > 4 ? "critical" : zScore > 3 ? "high" : "medium",
          confidence: Math.min(75 + zScore * 5, 100),
          metric,
          context: stats,
          previousValues: points.slice(Math.max(0, i - 2), i),
          nextValues: points.slice(i + 1, Math.min(points.length, i + 3)),
        }
        anomalies.push(anomaly)
      }
    }

  } catch (error) {
    console.error("[Anomaly Detection] Error in seasonal detection:", error)
  }

  return anomalies
}

/**
 * Use AI to detect complex anomalies that statistical methods might miss
 */
async function detectAIAnomalies(
  points: TimeseriesPoint[],
  metric: string
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []

  if (points.length < 5) return anomalies

  try {
    const AI_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are an expert at detecting anomalies in time series data. Analyze the following data and identify unusual patterns.

Return ONLY a JSON array of anomaly objects:
[{
  "bucket": "ISO date string",
  "value": number,
  "type": "spike" | "drop" | "outlier" | "trend_break" | "seasonal_anomaly" | "cluster_anomaly",
  "severity": "critical" | "high" | "medium" | "low",
  "description": "brief description",
  "confidence": number (0-100)
}]

Look for:
- Sudden spikes or drops
- Unusual patterns that break from the norm
- Values that are contextually anomalous
- Changes in trend or seasonality
- Clusters of unusual activity

Data for "${metric}":`

    const dataDescription = points.map(p => 
      `{"bucket": "${p.bucket}", "value": ${p.value}}`
    ).join(',\n')

    const prompt = `${AI_SYSTEM_PROMPT}
[${dataDescription}]`

    const result = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: AI_SYSTEM_PROMPT,
      prompt: prompt,
      temperature: 0.2,
      maxTokens: 2000,
    })

    // Parse AI response
    try {
      const responseText = result.text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            // Find the corresponding point
            const point = points.find(p => p.bucket === item.bucket)
            if (!point) continue

            // Calculate deviation from neighbors
            const index = points.findIndex(p => p.bucket === item.bucket)
            const prevValues = index > 0 ? [points[index - 1].value] : []
            const nextValues = index < points.length - 1 ? [points[index + 1].value] : []
            const neighbors = [...prevValues, ...nextValues]
            const avgNeighbor = neighbors.length > 0 
              ? neighbors.reduce((a, b) => a + b, 0) / neighbors.length
              : point.value

            const anomaly: DetectedAnomaly = {
              id: `ai_${metric}_${point.bucket}_${Math.random().toString(36).substr(2, 8)}`,
              timestamp: new Date(point.bucket).toISOString(),
              bucket: point.bucket,
              value: point.value,
              expectedValue: avgNeighbor,
              deviation: point.value - avgNeighbor,
              deviationPercentage: ((point.value - avgNeighbor) / Math.abs(avgNeighbor || 1)) * 100,
              method: "ai",
              type: item.type as AnomalyType || "outlier",
              severity: item.severity as AnomalySeverity || "medium",
              confidence: item.confidence || 70,
              metric,
              context: calculateStatistics(points.map(p => p.value)),
              previousValues: points.slice(Math.max(0, index - 2), index),
              nextValues: points.slice(index + 1, Math.min(points.length, index + 3)),
            }
            anomalies.push(anomaly)
          }
        }
      }
    } catch (error) {
      console.error("[Anomaly Detection] Error parsing AI response:", error)
    }

  } catch (error) {
    console.error("[Anomaly Detection] Error in AI detection:", error)
  }

  return anomalies
}

/**
 * Main function to detect anomalies in timeseries data
 */
export async function detectAnomalies(
  organizationId: string,
  metric: string,
  dateRange: { start: string; end: string },
  options: AnomalyDetectionOptions = {}
): Promise<{ anomalies: DetectedAnomaly[]; summary: { total: number; byMethod: Record<string, number>; bySeverity: Record<string, number>; byType: Record<string, number> } }> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Get timeseries data
  const points = await (async () => {
    const db = createServiceClient()
    const { data, error } = await db.rpc("analytics_event_timeseries", {
      p_org: organizationId,
      p_event: metric,
      p_category: "",
      p_start: dateRange.start,
      p_end: dateRange.end,
      p_granularity: "day",
      p_agg: "count",
    })

    if (error) {
      console.error("[Anomaly Detection] Error fetching timeseries:", error.message)
      return []
    }

    return (data ?? []).map((r: { bucket: string; value: number | string }) => ({
      bucket: r.bucket,
      value: Number(r.value),
    }))
  })()

  if (points.length < opts.minDataPoints!) {
    return {
      anomalies: [],
      summary: { total: 0, byMethod: {}, bySeverity: {}, byType: {} },
    }
  }

  // Collect anomalies from all methods
  const allAnomalies: DetectedAnomaly[] = []
  const byMethod: Record<string, number> = {}
  const bySeverity: Record<AnomalySeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const byType: Record<AnomalyType, number> = { spike: 0, drop: 0, outlier: 0, seasonal_anomaly: 0, trend_break: 0, cluster_anomaly: 0, contextual_anomaly: 0 }

  // Statistical methods
  if (opts.methods!.includes("zscore")) {
    const zscoreAnomalies = detectZScoreAnomalies(points, metric, opts.sensitivity)
    allAnomalies.push(...zscoreAnomalies)
    byMethod.zscore = zscoreAnomalies.length
  }

  if (opts.methods!.includes("iqr")) {
    const iqrAnomalies = detectIQRAnomalies(points, metric, opts.sensitivity)
    allAnomalies.push(...iqrAnomalies)
    byMethod.iqr = iqrAnomalies.length
  }

  if (opts.methods!.includes("mad")) {
    const madAnomalies = detectMADAnomalies(points, metric, opts.sensitivity)
    allAnomalies.push(...madAnomalies)
    byMethod.mad = madAnomalies.length
  }

  if (opts.methods!.includes("rolling_avg")) {
    const rollingAnomalies = detectRollingAvgAnomalies(points, metric, opts.rollingWindow!, opts.sensitivity)
    allAnomalies.push(...rollingAnomalies)
    byMethod.rolling_avg = rollingAnomalies.length
  }

  if (opts.methods!.includes("seasonal_decomposition")) {
    const seasonalAnomalies = await detectSeasonalAnomalies(organizationId, metric, points, opts.seasonalityPeriod!)
    allAnomalies.push(...seasonalAnomalies)
    byMethod.seasonal_decomposition = seasonalAnomalies.length
  }

  // AI method
  if (opts.useAI && opts.methods!.includes("ai")) {
    const aiAnomalies = await detectAIAnomalies(points, metric)
    allAnomalies.push(...aiAnomalies)
    byMethod.ai = aiAnomalies.length
  }

  // Deduplicate anomalies (same bucket and method)
  const seen = new Set<string>()
  const uniqueAnomalies = allAnomalies.filter(anomaly => {
    const key = `${anomaly.bucket}_${anomaly.method}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })

  // Filter by confidence
  const filteredAnomalies = uniqueAnomalies.filter(a => a.confidence >= opts.minConfidence!)

  // Update summary counts
  filteredAnomalies.forEach(anomaly => {
    bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1
    byType[anomaly.type] = (byType[anomaly.type] || 0) + 1
  })

  // Sort by severity and confidence
  const sortedAnomalies = filteredAnomalies.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
    if (severityDiff !== 0) return severityDiff
    return b.confidence - a.confidence
  })

  return {
    anomalies: sortedAnomalies,
    summary: {
      total: sortedAnomalies.length,
      byMethod,
      bySeverity,
      byType,
    },
  }
}

/**
 * Quick anomaly check for a specific data point
 */
export async function checkForAnomaly(
  organizationId: string,
  metric: string,
  value: number,
  timestamp: string,
  options: AnomalyDetectionOptions = {}
): Promise<DetectedAnomaly | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Get recent data for context
  const endDate = new Date(timestamp)
  const startDate = new Date(endDate.getTime() - opts.rollingWindow! * 24 * 60 * 60 * 1000)

  const dateRange = { start: startDate.toISOString(), end: endDate.toISOString() }

  const result = await detectAnomalies(organizationId, metric, dateRange, opts)

  // Find anomaly for the specific timestamp
  const anomaly = result.anomalies.find(a => a.bucket === timestamp || a.timestamp === timestamp)

  return anomaly || null
}

/**
 * Get anomaly statistics for a metric over a time period
 */
export async function getAnomalyStatistics(
  organizationId: string,
  metric: string,
  dateRange: { start: string; end: string },
  options: AnomalyDetectionOptions = {}
): Promise<{
  totalAnomalies: number
  anomalyRate: number
  avgDeviation: number
  mostCommonType: AnomalyType | null
  mostSevere: AnomalySeverity | null
  trend: "increasing" | "decreasing" | "stable"
}> {
  const result = await detectAnomalies(organizationId, metric, dateRange, options)

  if (result.anomalies.length === 0) {
    return {
      totalAnomalies: 0,
      anomalyRate: 0,
      avgDeviation: 0,
      mostCommonType: null,
      mostSevere: null,
      trend: "stable",
    }
  }

  // Calculate anomaly rate (anomalies per data point)
  // We'd need to know the total data points, but we can estimate from the date range
  const startDate = new Date(dateRange.start)
  const endDate = new Date(dateRange.end)
  const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  const estimatedDataPoints = Math.max(days, 1)
  const anomalyRate = result.anomalies.length / estimatedDataPoints

  // Average deviation
  const avgDeviation = result.anomalies.reduce((sum, a) => sum + Math.abs(a.deviation), 0) / result.anomalies.length

  // Most common type
  const typeCounts: Record<AnomalyType, number> = { spike: 0, drop: 0, outlier: 0, seasonal_anomaly: 0, trend_break: 0, cluster_anomaly: 0, contextual_anomaly: 0 }
  result.anomalies.forEach(a => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1
  })
  const mostCommonType = Object.entries(typeCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0] as AnomalyType || null

  // Most severe
  const severityOrder: Record<AnomalySeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const severities = result.anomalies.map(a => severityOrder[a.severity])
  const maxSeverity = Math.max(...severities)
  const mostSevere = Object.entries(severityOrder).find(([_, order]) => order === maxSeverity)?.[0] as AnomalySeverity || null

  // Trend (simplified - just look at recent anomalies)
  const recentAnomalies = result.anomalies.slice(-5)
  const recentSeverities = recentAnomalies.map(a => severityOrder[a.severity])
  const avgRecentSeverity = recentSeverities.reduce((a, b) => a + b, 0) / recentSeverities.length
  const prevSeverities = result.anomalies.slice(0, -5).map(a => severityOrder[a.severity])
  const avgPrevSeverity = prevSeverities.length > 0 ? prevSeverities.reduce((a, b) => a + b, 0) / prevSeverities.length : 0

  let trend: "increasing" | "decreasing" | "stable" = "stable"
  if (recentAnomalies.length >= 3) {
    if (avgRecentSeverity > avgPrevSeverity * 1.2) {
      trend = "increasing"
    } else if (avgRecentSeverity < avgPrevSeverity * 0.8) {
      trend = "decreasing"
    }
  }

  return {
    totalAnomalies: result.anomalies.length,
    anomalyRate,
    avgDeviation,
    mostCommonType,
    mostSevere,
    trend,
  }
}

export {
  calculateStatistics,
  AnomalyDetectionMethod,
  AnomalySeverity,
  AnomalyType,
}
