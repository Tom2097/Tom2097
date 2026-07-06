"use server"

import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"
import { detectAnomalies, getAnomalyStatistics } from "@/lib/analytics/anomaly-detection"
import { withAuth } from "@/lib/api/middleware"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/anomalies
 * 
 * Returns detected anomalies for a metric
 */
export async function GET(request: Request) {
  return withAuth(async (request, context) => {
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get("metric") ?? ""
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const methods = searchParams.get("methods")?.split(",") ?? undefined
    const minConfidence = searchParams.get("minConfidence") ? Number(searchParams.get("minConfidence")) : undefined

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: start, end" },
        { status: 400 }
      )
    }

    try {
      const [anomaliesResult, stats] = await Promise.all([
        detectAnomalies(context.organizationId, metric, { start, end }, {
          methods,
          minConfidence,
        }),
        getAnomalyStatistics(context.organizationId, metric, { start, end }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          anomalies: anomaliesResult.anomalies,
          summary: anomaliesResult.summary,
          statistics: stats,
        },
      })
    } catch (error) {
      logger.logError("[API] Error fetching anomalies:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch anomalies" },
        { status: 500 }
      )
    }
  })(request)
}