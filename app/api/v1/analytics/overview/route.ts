"use server"

import { type NextRequest, NextResponse } from "next/server"
import { getDashboardMetrics, getDashboardTimeseries, getDashboardAnomalies } from "@/lib/analytics/dashboard"
import { withAuth } from "@/lib/auth/with-auth"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/overview
 * 
 * Returns high-level analytics overview for the dashboard
 */
export const GET = withAuth(async (request: NextRequest, context) => {
  const { searchParams } = new URL(request.url)
  const timeRange = (searchParams.get("timeRange") as "today" | "7d" | "30d" | "90d" | null) ?? "7d"
  const customStart = searchParams.get("customStart")
  const customEnd = searchParams.get("customEnd")
  const eventName = searchParams.get("eventName") ?? undefined

  try {
    const [metrics, timeseries, anomalies] = await Promise.all([
      getDashboardMetrics(
        context.organizationId,
        timeRange,
        customStart && customEnd ? { start: customStart, end: customEnd } : undefined
      ),
      getDashboardTimeseries(
        context.organizationId,
        timeRange,
        customStart && customEnd ? { start: customStart, end: customEnd } : undefined,
        eventName
      ),
      getDashboardAnomalies(
        context.organizationId,
        timeRange,
        customStart && customEnd ? { start: customStart, end: customEnd } : undefined
      ),
    ])

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        timeseries,
        anomalies,
      },
    })
  } catch (error) {
    logger.logError("[API] Error fetching analytics overview:", error instanceof Error ? { message: error.message } : { error: String(error) })
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics overview" },
      { status: 500 }
    )
  }
})
