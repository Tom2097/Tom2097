"use server"

import { type NextRequest, NextResponse } from "next/server"
import { getPerformanceMetrics, compareMetrics, type MetricConfig } from "@/lib/analytics/metrics"
import { withAuth } from "@/lib/auth/with-auth"
import { logger } from "@/lib/logging"

/**
 * Default metric configurations
 */
const DEFAULT_METRICS: MetricConfig[] = [
  {
    name: "Revenue",
    type: "revenue",
    description: "Total revenue from all transactions",
    eventName: "transaction_completed",
    aggregate: "sum",
    valueField: "amount",
    unit: "USD",
    target: 10000,
    comparisonPeriod: "week",
  },
  {
    name: "Conversion Rate",
    type: "conversion",
    description: "Percentage of visitors who complete a purchase",
    eventName: "purchase_completed",
    aggregate: "count",
    unit: "%",
    target: 3,
    comparisonPeriod: "week",
  },
  {
    name: "User Engagement",
    type: "engagement",
    description: "Average session duration per user",
    eventName: "session_end",
    aggregate: "avg",
    valueField: "duration",
    unit: "minutes",
    target: 5,
    comparisonPeriod: "week",
  },
  {
    name: "Retention Rate",
    type: "retention",
    description: "Percentage of users returning within 7 days",
    eventName: "user_returned",
    aggregate: "count",
    unit: "%",
    target: 25,
    comparisonPeriod: "month",
  },
]

/**
 * GET /api/v1/analytics/metrics
 * 
 * Returns performance metrics for the organization
 */
export const GET = withAuth(async (request: NextRequest, context) => {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get("start")
  const end = searchParams.get("end")
  const metricNames = searchParams.getAll("metric")

  if (!start || !end) {
    return NextResponse.json(
      { success: false, error: "Missing required parameters: start, end" },
      { status: 400 }
    )
  }

  try {
    // Filter metrics based on query params
    const metricsToFetch = metricNames.length > 0
      ? DEFAULT_METRICS.filter(m => metricNames.includes(m.name))
      : DEFAULT_METRICS

    const metrics = await getPerformanceMetrics(
      context.organizationId,
      metricsToFetch,
      { start, end }
    )

    return NextResponse.json({
      success: true,
      data: metrics,
    })
  } catch (error) {
    logger.logError("[API] Error fetching metrics:", error instanceof Error ? { message: error.message } : { error: String(error) })
    return NextResponse.json(
      { success: false, error: "Failed to fetch metrics" },
      { status: 500 }
    )
  }
})

/**
 * POST /api/v1/analytics/metrics/compare
 * 
 * Compare metrics between two time periods
 */
export const POST = withAuth(async (request: NextRequest, context) => {
  const { metricName, period1, period2 } = await request.json()

  if (!metricName || !period1 || !period2) {
    return NextResponse.json(
      { success: false, error: "Missing required parameters: metricName, period1, period2" },
      { status: 400 }
    )
  }

  try {
    const metricConfig = DEFAULT_METRICS.find(m => m.name === metricName)
    if (!metricConfig) {
      return NextResponse.json(
        { success: false, error: "Metric not found" },
        { status: 404 }
      )
    }

    const comparison = await compareMetrics(
      context.organizationId,
      metricConfig,
      period1,
      period2
    )

    return NextResponse.json({
      success: true,
      data: comparison,
    })
  } catch (error) {
    logger.logError("[API] Error comparing metrics:", error instanceof Error ? { message: error.message } : { error: String(error) })
    return NextResponse.json(
      { success: false, error: "Failed to compare metrics" },
      { status: 500 }
    )
  }
})
