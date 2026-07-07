"use server"

import { type NextRequest, NextResponse } from "next/server"
import { detectAnomalies, getAnomalyStatistics, type AnomalyDetectionMethod } from "@/lib/analytics/anomaly-detection"
import { withAuth } from "@/lib/auth/with-auth"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/anomalies
 * 
 * Returns detected anomalies for a metric
 */
export const GET = withAuth(async (request: NextRequest, context) => {
  const { searchParams } = new URL(request.url)
  const metric = searchParams.get("metric") ?? ""
  const start = searchParams.get("start")
  const end = searchParams.get("end")
  const methodsParam = searchParams.get("methods")
  const methods = methodsParam
    ? methodsParam.split(",").filter((m): m is AnomalyDetectionMethod =>
        ["zscore", "iqr", "isolation_forest", "prophet", "threshold"].includes(m)
      )
    : undefined
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
    logger.logError("[API] Error fetching anomalies:", error instanceof Error ? { message: error.message } : { error: String(error) })
    return NextResponse.json(
      { success: false, error: "Failed to fetch anomalies" },
      { status: 500 }
    )
  }
})
