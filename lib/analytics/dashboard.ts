"use strict"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"
import { type TimeseriesPoint } from "./types"
import { detectAnomalies } from "./anomaly-detection"

/**
 * Key performance metrics for the dashboard overview
 */
export interface DashboardMetrics {
  totalEvents: number
  uniqueUsers: number
  eventsPerUser: number
  topEvents: Array<{ event_name: string; count: number }>
  recentAnomalies: number
  growthRate: number
  retentionRate: number
}

/**
 * Time range for dashboard queries
 */
export type DashboardTimeRange = "today" | "7d" | "30d" | "90d" | "custom"

/**
 * Get overview metrics for the dashboard
 */
export async function getDashboardMetrics(
  organizationId: string,
  timeRange: DashboardTimeRange = "7d",
  customRange?: { start: string; end: string }
): Promise<DashboardMetrics> {
  const db = createServiceClient()
  const { start, end } = getTimeRangeDates(timeRange, customRange)

  try {
    // Fetch summary metrics
    const { data: summary, error: summaryError } = await db.rpc("analytics_event_summary", {
      p_org: organizationId,
      p_start: start,
      p_end: end,
    })

    if (summaryError) throw summaryError

    const totalEvents = Number(summary?.total_events ?? 0)
    const uniqueUsers = Number(summary?.unique_users ?? 0)
    const eventsPerUser = uniqueUsers > 0 ? totalEvents / uniqueUsers : 0

    // Fetch top events
    const { data: topEvents, error: topEventsError } = await db.rpc("analytics_event_breakdown", {
      p_org: organizationId,
      p_event: "",
      p_category: "",
      p_dimension: "event_name",
      p_start: start,
      p_end: end,
      p_agg: "count",
      p_limit: 5,
    })

    if (topEventsError) throw topEventsError

    // Fetch recent anomalies
    const anomaliesResult = await detectAnomalies(organizationId, "", { start, end }, {
      methods: ["zscore", "iqr"],
      minConfidence: 75,
    })

    // Calculate growth rate (compare to previous period)
    const previousStart = new Date(start)
    previousStart.setDate(previousStart.getDate() - getDaysInRange(timeRange))
    const previousEnd = new Date(start)

    const { data: previousSummary, error: previousError } = await db.rpc("analytics_event_summary", {
      p_org: organizationId,
      p_start: previousStart.toISOString(),
      p_end: previousEnd.toISOString(),
    })

    if (previousError) throw previousError

    const previousTotal = Number(previousSummary?.total_events ?? 0)
    const growthRate = previousTotal > 0 ? (totalEvents - previousTotal) / previousTotal : 0

    // Fetch retention rate (simplified - 7-day retention)
    const retentionStart = new Date(start)
    retentionStart.setDate(retentionStart.getDate() - 7)
    const retentionEnd = new Date(end)

    const { data: retentionData, error: retentionError } = await db.rpc("analytics_event_retention", {
      p_org: organizationId,
      p_event: "",
      p_start: retentionStart.toISOString(),
      p_end: retentionEnd.toISOString(),
    })

    if (retentionError) throw retentionError

    const retentionRate = retentionData?.[0]?.retention ?? 0

    return {
      totalEvents,
      uniqueUsers,
      eventsPerUser,
      topEvents: topEvents ?? [],
      recentAnomalies: anomaliesResult.anomalies.length,
      growthRate,
      retentionRate,
    }
  } catch (error) {
    logger.logError("[Dashboard] Error fetching metrics:", error)
    throw new Error("Failed to fetch dashboard metrics")
  }
}

/**
 * Get timeseries data for dashboard charts
 */
export async function getDashboardTimeseries(
  organizationId: string,
  timeRange: DashboardTimeRange = "7d",
  customRange?: { start: string; end: string },
  eventName?: string
): Promise<TimeseriesPoint[]> {
  const db = createServiceClient()
  const { start, end } = getTimeRangeDates(timeRange, customRange)
  const granularity = getGranularityForRange(timeRange)

  try {
    const { data, error } = await db.rpc("analytics_event_timeseries", {
      p_org: organizationId,
      p_event: eventName ?? "",
      p_category: "",
      p_start: start,
      p_end: end,
      p_granularity: granularity,
      p_agg: "count",
    })

    if (error) throw error

    return (data ?? []).map((r: { bucket: string; value: number | string }) => ({
      bucket: r.bucket,
      value: Number(r.value),
    }))
  } catch (error) {
    logger.logError("[Dashboard] Error fetching timeseries:", error)
    throw new Error("Failed to fetch timeseries data")
  }
}

/**
 * Get anomaly data for dashboard visualization
 */
export async function getDashboardAnomalies(
  organizationId: string,
  timeRange: DashboardTimeRange = "7d",
  customRange?: { start: string; end: string }
) {
  const { start, end } = getTimeRangeDates(timeRange, customRange)

  try {
    const result = await detectAnomalies(organizationId, "", { start, end }, {
      methods: ["zscore", "iqr", "rolling_avg"],
      minConfidence: 75,
    })

    return {
      anomalies: result.anomalies,
      summary: result.summary,
    }
  } catch (error) {
    logger.logError("[Dashboard] Error fetching anomalies:", error)
    throw new Error("Failed to fetch anomaly data")
  }
}

/**
 * Helper to get date range for dashboard queries
 */
function getTimeRangeDates(
  range: DashboardTimeRange,
  customRange?: { start: string; end: string }
): { start: string; end: string } {
  const end = new Date()

  if (range === "custom" && customRange) {
    return {
      start: customRange.start,
      end: customRange.end,
    }
  }

  const start = new Date(end)
  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0)
      break
    case "7d":
      start.setDate(start.getDate() - 7)
      break
    case "30d":
      start.setDate(start.getDate() - 30)
      break
    case "90d":
      start.setDate(start.getDate() - 90)
      break
    default:
      start.setDate(start.getDate() - 7)
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

/**
 * Helper to get granularity based on time range
 */
function getGranularityForRange(range: DashboardTimeRange): "hour" | "day" | "week" {
  switch (range) {
    case "today":
      return "hour"
    case "7d":
      return "day"
    case "30d":
    case "90d":
    case "custom":
      return "week"
    default:
      return "day"
  }
}

/**
 * Helper to get number of days in a time range
 */
function getDaysInRange(range: DashboardTimeRange): number {
  switch (range) {
    case "today":
      return 1
    case "7d":
      return 7
    case "30d":
      return 30
    case "90d":
      return 90
    default:
      return 7
  }
}