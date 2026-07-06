"use strict"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"
import { type TimeseriesPoint } from "./types"
import { detectAnomalies } from "./anomaly-detection"

/**
 * Performance metric types
 */
export type MetricType =
  | "revenue"
  | "conversion"
  | "retention"
  | "engagement"
  | "performance"
  | "custom"

/**
 * Metric comparison result
 */
export interface MetricComparison {
  currentValue: number
  previousValue: number
  change: number
  changePercentage: number
  trend: "increasing" | "decreasing" | "stable"
  isImproving: boolean
}

/**
 * Performance metric with historical data
 */
export interface PerformanceMetric {
  id: string
  name: string
  type: MetricType
  description: string
  currentValue: number
  unit: string
  comparison: MetricComparison
  timeseries: TimeseriesPoint[]
  anomalies: number
  target?: number
  targetMet: boolean
}

/**
 * Metric tracking configuration
 */
export interface MetricConfig {
  name: string
  type: MetricType
  description: string
  eventName?: string
  eventCategory?: string
  aggregate: "count" | "sum" | "avg" | "min" | "max"
  valueField?: string
  unit: string
  target?: number
  comparisonPeriod?: "day" | "week" | "month"
}

/**
 * Get all performance metrics for an organization
 */
export async function getPerformanceMetrics(
  organizationId: string,
  configs: MetricConfig[],
  timeRange: { start: string; end: string }
): Promise<PerformanceMetric[]> {
  const db = createServiceClient()
  const results: PerformanceMetric[] = []

  try {
    for (const config of configs) {
      // Get current value
      const { data, error } = await db.rpc("analytics_event_metric", {
        p_org: organizationId,
        p_event: config.eventName ?? "",
        p_category: config.eventCategory ?? "",
        p_start: timeRange.start,
        p_end: timeRange.end,
        p_agg: config.aggregate,
        p_value_field: config.valueField ?? null,
      })

      if (error) throw error

      const currentValue = Number(data ?? 0)

      // Get previous period value for comparison
      const previousStart = new Date(timeRange.start)
      const previousEnd = new Date(timeRange.start)
      const rangeDays = (new Date(timeRange.end).getTime() - new Date(timeRange.start).getTime()) / (1000 * 60 * 60 * 24)

      switch (config.comparisonPeriod) {
        case "week":
          previousStart.setDate(previousStart.getDate() - rangeDays * 2)
          previousEnd.setDate(previousEnd.getDate() - rangeDays)
          break
        case "month":
          previousStart.setMonth(previousStart.getMonth() - 1)
          previousEnd.setDate(previousEnd.getDate() - rangeDays)
          break
        default: // day
          previousStart.setDate(previousStart.getDate() - rangeDays)
          previousEnd.setDate(previousEnd.getDate() - rangeDays)
      }

      const { data: previousData, error: previousError } = await db.rpc("analytics_event_metric", {
        p_org: organizationId,
        p_event: config.eventName ?? "",
        p_category: config.eventCategory ?? "",
        p_start: previousStart.toISOString(),
        p_end: previousEnd.toISOString(),
        p_agg: config.aggregate,
        p_value_field: config.valueField ?? null,
      })

      if (previousError) throw previousError

      const previousValue = Number(previousData ?? 0)
      const change = currentValue - previousValue
      const changePercentage = previousValue > 0 ? (change / previousValue) * 100 : 0
      const trend = Math.abs(changePercentage) > 5
        ? changePercentage > 0
          ? "increasing"
          : "decreasing"
        : "stable"
      const isImproving = config.type === "revenue" || config.type === "conversion" || config.type === "retention" || config.type === "engagement"
        ? changePercentage > 0
        : changePercentage < 0

      // Get timeseries data
      const { data: timeseriesData, error: timeseriesError } = await db.rpc("analytics_event_timeseries", {
        p_org: organizationId,
        p_event: config.eventName ?? "",
        p_category: config.eventCategory ?? "",
        p_start: timeRange.start,
        p_end: timeRange.end,
        p_granularity: "day",
        p_agg: config.aggregate,
      })

      if (timeseriesError) throw timeseriesError

      const timeseries = (timeseriesData ?? []).map((r: { bucket: string; value: number | string }) => ({
        bucket: r.bucket,
        value: Number(r.value),
      }))

      // Detect anomalies
      const anomaliesResult = await detectAnomalies(organizationId, config.eventName ?? "", timeRange, {
        methods: ["zscore", "iqr"],
        minConfidence: 75,
      })

      // Check if target is met
      const targetMet = config.target !== undefined ? currentValue >= config.target : false

      results.push({
        id: `${organizationId}_${config.name.replace(/\s+/g, "_")}`,
        name: config.name,
        type: config.type,
        description: config.description,
        currentValue,
        unit: config.unit,
        comparison: {
          currentValue,
          previousValue,
          change,
          changePercentage,
          trend,
          isImproving,
        },
        timeseries,
        anomalies: anomaliesResult.anomalies.length,
        target: config.target,
        targetMet,
      })
    }

    return results
  } catch (error) {
    logger.logError("[Metrics] Error fetching performance metrics:", error)
    throw new Error("Failed to fetch performance metrics")
  }
}

/**
 * Get metric comparison between two time periods
 */
export async function compareMetrics(
  organizationId: string,
  metricConfig: MetricConfig,
  period1: { start: string; end: string },
  period2: { start: string; end: string }
): Promise<MetricComparison> {
  const db = createServiceClient()

  try {
    // Get period 1 value
    const { data: data1, error: error1 } = await db.rpc("analytics_event_metric", {
      p_org: organizationId,
      p_event: metricConfig.eventName ?? "",
      p_category: metricConfig.eventCategory ?? "",
      p_start: period1.start,
      p_end: period1.end,
      p_agg: metricConfig.aggregate,
      p_value_field: metricConfig.valueField ?? null,
    })

    if (error1) throw error1

    const value1 = Number(data1 ?? 0)

    // Get period 2 value
    const { data: data2, error: error2 } = await db.rpc("analytics_event_metric", {
      p_org: organizationId,
      p_event: metricConfig.eventName ?? "",
      p_category: metricConfig.eventCategory ?? "",
      p_start: period2.start,
      p_end: period2.end,
      p_agg: metricConfig.aggregate,
      p_value_field: metricConfig.valueField ?? null,
    })

    if (error2) throw error2

    const value2 = Number(data2 ?? 0)
    const change = value2 - value1
    const changePercentage = value1 > 0 ? (change / value1) * 100 : 0
    const trend = Math.abs(changePercentage) > 5
      ? changePercentage > 0
        ? "increasing"
        : "decreasing"
      : "stable"
    const isImproving = metricConfig.type === "revenue" || metricConfig.type === "conversion" || metricConfig.type === "retention" || metricConfig.type === "engagement"
      ? changePercentage > 0
      : changePercentage < 0

    return {
      currentValue: value2,
      previousValue: value1,
      change,
      changePercentage,
      trend,
      isImproving,
    }
  } catch (error) {
    logger.logError("[Metrics] Error comparing metrics:", error)
    throw new Error("Failed to compare metrics")
  }
}

/**
 * Get metric trends over multiple time periods
 */
export async function getMetricTrends(
  organizationId: string,
  metricConfig: MetricConfig,
  periods: Array<{ start: string; end: string }>
): Promise<Array<{ period: string; value: number }>> {
  const db = createServiceClient()
  const results = []

  try {
    for (const period of periods) {
      const { data, error } = await db.rpc("analytics_event_metric", {
        p_org: organizationId,
        p_event: metricConfig.eventName ?? "",
        p_category: metricConfig.eventCategory ?? "",
        p_start: period.start,
        p_end: period.end,
        p_agg: metricConfig.aggregate,
        p_value_field: metricConfig.valueField ?? null,
      })

      if (error) throw error

      results.push({
        period: `${period.start} to ${period.end}`,
        value: Number(data ?? 0),
      })
    }

    return results
  } catch (error) {
    logger.logError("[Metrics] Error fetching metric trends:", error)
    throw new Error("Failed to fetch metric trends")
  }
}