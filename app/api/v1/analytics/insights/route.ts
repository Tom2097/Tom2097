import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { detectInsights, getMetricInsights, type InsightDetectionOptions } from "@/lib/analytics/insight-engine"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/insights
 *
 * Detect insights (trends, anomalies, correlations, top performers) from the
 * organization's analytics data. Pass ?metric= to scope to a single metric.
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get("metric")
    const focusMetricsParam = searchParams.get("focusMetrics")
    const useAI = searchParams.get("useAI") !== "false" // defaults to true, matching lib default

    const options: InsightDetectionOptions = {
      focusMetrics: focusMetricsParam ? focusMetricsParam.split(",").map((m) => m.trim()).filter(Boolean) : undefined,
      minChangePercentage: searchParams.get("minChangePercentage") ? Number(searchParams.get("minChangePercentage")) : undefined,
      minConfidence: searchParams.get("minConfidence") ? Number(searchParams.get("minConfidence")) : undefined,
      topDimensions: searchParams.get("topDimensions") ? Number(searchParams.get("topDimensions")) : undefined,
      trendLookbackDays: searchParams.get("trendLookbackDays") ? Number(searchParams.get("trendLookbackDays")) : undefined,
      useAI,
    }

    if (useAI) {
      // detectInsights calls generateText per focus metric when useAI is on --
      // meter it per tenant like every other LLM-calling route (forecast.ts).
      const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
      if (rateLimited) return rateLimited
    }

    try {
      if (metric) {
        const insights = await getMetricInsights(context.organizationId, metric, options)
        return NextResponse.json({ success: true, data: { insights } })
      }
      const result = await detectInsights(context.organizationId, options)
      return NextResponse.json({ success: true, data: result })
    } catch (error) {
      logger.logError("[API] Error detecting insights:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to detect insights" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
