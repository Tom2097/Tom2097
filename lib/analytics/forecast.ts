"use strict"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"
import { type TimeseriesPoint } from "./types"
import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"

/**
 * Forecast result with predicted values and confidence intervals
 */
export interface ForecastResult {
  forecast: TimeseriesPoint[]
  confidenceIntervals: Array<{
    bucket: string
    lower: number
    upper: number
  }>
  modelMetrics: {
    mae: number
    rmse: number
    rSquared: number
  }
  trend: "increasing" | "decreasing" | "stable"
  seasonality: "none" | "daily" | "weekly" | "monthly"
}

/**
 * Forecasting options
 */
export interface ForecastOptions {
  /** Number of periods to forecast ahead */
  periods?: number
  /** Confidence interval (0-1) */
  confidence?: number
  /** Include seasonality detection */
  detectSeasonality?: boolean
  /** Use AI for complex pattern detection */
  useAI?: boolean
}

const DEFAULT_OPTIONS: Required<ForecastOptions> = {
  periods: 7,
  confidence: 0.95,
  detectSeasonality: true,
  useAI: true,
}

/**
 * Simple linear regression for trend forecasting
 */
function linearRegression(
  points: TimeseriesPoint[]
): {
  slope: number
  intercept: number
  rSquared: number
} {
  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  // Convert timestamps to numeric values (days since epoch)
  const xValues = points.map((p, i) => i)
  const yValues = points.map(p => p.value)

  for (let i = 0; i < n; i++) {
    sumX += xValues[i]
    sumY += yValues[i]
    sumXY += xValues[i] * yValues[i]
    sumX2 += xValues[i] * xValues[i]
    sumY2 += yValues[i] * yValues[i]
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  const rSquared = Math.pow(
    (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)),
    2
  )

  return { slope, intercept, rSquared }
}

/**
 * Simple moving average for smoothing
 */
function movingAverage(points: TimeseriesPoint[], window: number = 3): TimeseriesPoint[] {
  return points.map((point, i) => {
    if (i < window - 1) return point
    const windowPoints = points.slice(i - window + 1, i + 1)
    const avg = windowPoints.reduce((sum, p) => sum + p.value, 0) / window
    return { ...point, value: avg }
  })
}

/**
 * Detect seasonality in timeseries data
 */
function detectSeasonality(points: TimeseriesPoint[]): "none" | "daily" | "weekly" | "monthly" {
  if (points.length < 14) return "none"

  // Check for weekly seasonality (7-day patterns)
  const dayValues: Record<number, number[]> = {}
  points.forEach(p => {
    const date = new Date(p.bucket)
    const dayOfWeek = date.getDay()
    if (!dayValues[dayOfWeek]) dayValues[dayOfWeek] = []
    dayValues[dayOfWeek].push(p.value)
  })

  const dayAverages = Object.values(dayValues).map(values =>
    values.reduce((a, b) => a + b, 0) / values.length
  )
  const dayStdDev = Math.sqrt(
    dayAverages.reduce((sq, avg) => sq + Math.pow(avg - dayAverages.reduce((a, b) => a + b, 0) / dayAverages.length, 2), 0) /
      dayAverages.length
  )

  if (dayStdDev > 0.1 * dayAverages.reduce((a, b) => a + b, 0) / dayAverages.length) {
    return "weekly"
  }

  return "none"
}

/**
 * Generate forecast using statistical methods
 */
export async function generateStatisticalForecast(
  organizationId: string,
  eventName: string,
  dateRange: { start: string; end: string },
  options: ForecastOptions = {}
): Promise<ForecastResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const db = createServiceClient()

  try {
    // Get historical data
    const { data, error } = await db.rpc("analytics_event_timeseries", {
      p_org: organizationId,
      p_event: eventName,
      p_category: "",
      p_start: dateRange.start,
      p_end: dateRange.end,
      p_granularity: "day",
      p_agg: "count",
    })

    if (error) throw error

    const points = (data ?? []).map((r: { bucket: string; value: number | string }) => ({
      bucket: r.bucket,
      value: Number(r.value),
    }))

    if (points.length < 5) {
      throw new Error("Not enough data points for forecasting")
    }

    // Smooth the data
    const smoothedPoints = movingAverage(points, 3)

    // Detect trend
    const regression = linearRegression(smoothedPoints)
    const trend: "increasing" | "decreasing" | "stable" = regression.slope > 0.1
      ? "increasing"
      : regression.slope < -0.1
      ? "decreasing"
      : "stable"

    // Detect seasonality
    const seasonality = opts.detectSeasonality ? detectSeasonality(points) : "none"

    // Generate forecast
    const lastDate = new Date(points[points.length - 1].bucket)
    const forecast: TimeseriesPoint[] = []
    const confidenceIntervals: Array<{
      bucket: string
      lower: number
      upper: number
    }> = []

    for (let i = 1; i <= opts.periods; i++) {
      const nextDate = new Date(lastDate)
      nextDate.setDate(nextDate.getDate() + i)
      const x = points.length + i - 1
      const predictedValue = regression.slope * x + regression.intercept

      // Add seasonality component if detected
      let seasonalValue = predictedValue
      if (seasonality === "weekly") {
        const dayOfWeek = nextDate.getDay()
        const historicalValues = points
          .filter(p => new Date(p.bucket).getDay() === dayOfWeek)
          .map(p => p.value)
        if (historicalValues.length > 0) {
          const avg = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length
          seasonalValue = predictedValue * (avg / points.reduce((a, b) => a + b.value, 0) / points.length)
        }
      }

      forecast.push({
        bucket: nextDate.toISOString(),
        value: Math.max(0, seasonalValue),
      })

      // Calculate confidence interval (simplified)
      const stdDev = Math.sqrt(
        points.reduce((sq, p) => sq + Math.pow(p.value - (regression.slope * points.indexOf(p) + regression.intercept), 2), 0) /
          points.length
      )
      const zScore = 1.96 // 95% confidence
      confidenceIntervals.push({
        bucket: nextDate.toISOString(),
        lower: Math.max(0, seasonalValue - zScore * stdDev),
        upper: seasonalValue + zScore * stdDev,
      })
    }

    // Calculate model metrics (on training data)
    const mae = points.reduce(
      (sum, p) => sum + Math.abs(p.value - (regression.slope * points.indexOf(p) + regression.intercept)),
      0
    ) / points.length

    const rmse = Math.sqrt(
      points.reduce(
        (sq, p) => sq + Math.pow(p.value - (regression.slope * points.indexOf(p) + regression.intercept), 2),
        0
      ) / points.length
    )

    return {
      forecast,
      confidenceIntervals,
      modelMetrics: {
        mae,
        rmse,
        rSquared: regression.rSquared,
      },
      trend,
      seasonality,
    }
  } catch (error) {
    logger.logError("[Forecast] Error generating statistical forecast:", error)
    throw new Error("Failed to generate forecast")
  }
}

/**
 * Generate forecast using AI (for complex patterns)
 */
export async function generateAIForecast(
  points: TimeseriesPoint[],
  options: ForecastOptions = {}
): Promise<ForecastResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  try {
    const AI_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are an expert at time series forecasting. Analyze the following data and generate a forecast.

Return ONLY a JSON object with this structure:
{
  "forecast": [{"bucket": "ISO date string", "value": number}],
  "confidenceIntervals": [{"bucket": "ISO date string", "lower": number, "upper": number}],
  "trend": "increasing" | "decreasing" | "stable",
  "seasonality": "none" | "daily" | "weekly" | "monthly",
  "description": "brief description of the forecast and key patterns"
}

Guidelines:
- Forecast the next ${opts.periods} periods
- Provide 95% confidence intervals
- Identify trend and seasonality
- Be realistic about uncertainty
- Values should be non-negative

Data:`

    const dataDescription = points
      .map(p => `{"bucket": "${p.bucket}", "value": ${p.value}}`)
      .join(",\n")

    const prompt = `${AI_SYSTEM_PROMPT}\n[${dataDescription}]`

    const result = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: AI_SYSTEM_PROMPT,
      prompt: prompt,
      temperature: 0.3,
      maxOutputTokens: 2000,
    })

    // Parse AI response
    try {
      const responseText = result.text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        // Validate and format the response
        const forecast = Array.isArray(parsed.forecast)
          ? parsed.forecast.map((p: any) => ({
              bucket: p.bucket,
              value: Number(p.value),
            }))
          : []

        const confidenceIntervals = Array.isArray(parsed.confidenceIntervals)
          ? parsed.confidenceIntervals.map((ci: any) => ({
              bucket: ci.bucket,
              lower: Number(ci.lower),
              upper: Number(ci.upper),
            }))
          : []

        return {
          forecast: forecast.slice(0, opts.periods),
          confidenceIntervals: confidenceIntervals.slice(0, opts.periods),
          modelMetrics: {
            mae: 0, // AI doesn't provide these
            rmse: 0,
            rSquared: 0,
          },
          trend: parsed.trend || "stable",
          seasonality: parsed.seasonality || "none",
        }
      }

      throw new Error("Invalid AI response format")
    } catch (error) {
      logger.logError("[Forecast] Error parsing AI response:", error)
      throw new Error("Failed to parse AI forecast")
    }
  } catch (error) {
    logger.logError("[Forecast] Error generating AI forecast:", error)
    throw new Error("Failed to generate AI forecast")
  }
}

/**
 * Main forecast function that combines statistical and AI methods
 */
export async function generateForecast(
  organizationId: string,
  eventName: string,
  dateRange: { start: string; end: string },
  options: ForecastOptions = {}
): Promise<ForecastResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  try {
    // Get historical data
    const db = createServiceClient()
    const { data, error } = await db.rpc("analytics_event_timeseries", {
      p_org: organizationId,
      p_event: eventName,
      p_category: "",
      p_start: dateRange.start,
      p_end: dateRange.end,
      p_granularity: "day",
      p_agg: "count",
    })

    if (error) throw error

    const points = (data ?? []).map((r: { bucket: string; value: number | string }) => ({
      bucket: r.bucket,
      value: Number(r.value),
    }))

    if (points.length < 5) {
      throw new Error("Not enough data points for forecasting")
    }

    // Use AI for complex patterns, statistical for simple cases
    if (opts.useAI) {
      return generateAIForecast(points, opts)
    } else {
      return generateStatisticalForecast(organizationId, eventName, dateRange, opts)
    }
  } catch (error) {
    logger.logError("[Forecast] Error generating forecast:", error)
    throw new Error("Failed to generate forecast")
  }
}