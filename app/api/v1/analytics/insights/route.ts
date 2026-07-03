import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { detectInsights, getMetricInsights, getTopInsight, refreshInsights } from "@/lib/analytics/insight-engine"
import type { Insight, InsightDetectionOptions } from "@/lib/analytics/insight-engine"

/**
 * GET /api/v1/analytics/insights
 * Get automatically detected insights for an organization.
 * 
 * Query parameters:
 * - focusMetrics: Comma-separated list of metrics to focus on
 * - minChangePercentage: Minimum change percentage to trigger trend insights (default: 10)
 * - minConfidence: Minimum confidence threshold (0-100) (default: 60)
 * - lookbackDays: Number of days to look back (default: 30)
 * - useAI: Whether to use AI for deeper analysis (default: true)
 * 
 * Response:
 * {
 *   "success": boolean
 *   "insights": Insight[]
 *   "summary": { total: number; high: number; medium: number; low: number }
 *   "generatedAt": string
 * }
 */

interface InsightsRequest {
  focusMetrics?: string[]
  minChangePercentage?: number
  minConfidence?: number
  lookbackDays?: number
  useAI?: boolean
}

interface InsightsResponse {
  success: boolean
  insights?: Insight[]
  summary?: { total: number; high: number; medium: number; low: number }
  generatedAt?: string
  error?: string
}

const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse query parameters
      const { searchParams } = new URL(req.url)
      
      const focusMetrics = searchParams.get("focusMetrics")?.split(",") || []
      const minChangePercentage = searchParams.get("minChangePercentage") 
        ? parseFloat(searchParams.get("minChangePercentage")!) 
        : undefined
      const minConfidence = searchParams.get("minConfidence") 
        ? parseInt(searchParams.get("minConfidence")!) 
        : undefined
      const lookbackDays = searchParams.get("lookbackDays") 
        ? parseInt(searchParams.get("lookbackDays")!) 
        : undefined
      const useAI = searchParams.get("useAI")?.toLowerCase() === "true" ? true : 
                   searchParams.get("useAI")?.toLowerCase() === "false" ? false : 
                   undefined

      const options: InsightDetectionOptions = {}
      if (focusMetrics.length > 0) options.focusMetrics = focusMetrics
      if (minChangePercentage !== undefined) options.minChangePercentage = minChangePercentage
      if (minConfidence !== undefined) options.minConfidence = minConfidence
      if (lookbackDays !== undefined) options.trendLookbackDays = lookbackDays
      if (useAI !== undefined) options.useAI = useAI

      // Get insights
      const result = await detectInsights(organizationId, options)

      const response: InsightsResponse = {
        success: true,
        insights: result.insights,
        summary: result.summary,
        generatedAt: new Date().toISOString(),
      }

      return NextResponse.json(response, { status: 200 })

    } catch (error) {
      console.error("[Insights API] Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as InsightsResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

/**
 * POST /api/v1/analytics/insights
 * Refresh insights or get insights for specific metrics.
 * 
 * Request body:
 * {
 *   "action": "refresh" | "metric",
 *   "metrics"?: string[] - Metrics to focus on (for "metric" action)
 *   "options"?: InsightDetectionOptions
 * }
 * 
 * Response:
 * {
 *   "success": boolean
 *   "insights": Insight[] | Insight (depending on action)
 *   "generatedAt": string
 * }
 */

interface InsightsPostRequest {
  action: "refresh" | "metric" | "top"
  metric?: string
  metrics?: string[]
  options?: InsightDetectionOptions
}

const postHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse request body
      let body: InsightsPostRequest
      try {
        body = await req.json()
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" } as InsightsResponse,
          { status: 400 }
        )
      }

      // Validate action
      if (!body.action || !["refresh", "metric", "top"].includes(body.action)) {
        return NextResponse.json(
          { success: false, error: "action must be 'refresh', 'metric', or 'top'" } as InsightsResponse,
          { status: 400 }
        )
      }

      let result: { insights: Insight[]; generatedAt: string } | { insights: Insight[]; summary: Record<string, unknown> } | Insight | null

      switch (body.action) {
        case "refresh":
          result = await refreshInsights(organizationId, body.options || {})
          break
          
        case "metric":
          if (!body.metric) {
            return NextResponse.json(
              { success: false, error: "metric is required for 'metric' action" } as InsightsResponse,
              { status: 400 }
            )
          }
          const insights = await getMetricInsights(organizationId, body.metric, body.options || {})
          result = { insights, generatedAt: new Date().toISOString() }
          break
          
        case "top":
          if (!body.metric) {
            return NextResponse.json(
              { success: false, error: "metric is required for 'top' action" } as InsightsResponse,
              { status: 400 }
            )
          }
          const topInsight = await getTopInsight(organizationId, body.metric, body.options || {})
          if (!topInsight) {
            return NextResponse.json(
              { success: true, insights: [], message: "No insights found for this metric" } as InsightsResponse,
              { status: 200 }
            )
          }
          result = topInsight
          break
          
        default:
          return NextResponse.json(
            { success: false, error: "Invalid action" } as InsightsResponse,
            { status: 400 }
          )
      }

      if (result && "insights" in result && "generatedAt" in result) {
        return NextResponse.json({
          success: true,
          insights: result.insights,
          generatedAt: result.generatedAt,
        } as InsightsResponse, { status: 200 })
      } else if (result && "insights" in result && "summary" in result) {
        return NextResponse.json({
          success: true,
          insights: result.insights,
          summary: result.summary,
          generatedAt: new Date().toISOString(),
        } as InsightsResponse, { status: 200 })
      } else if (result && "id" in result) {
        // Single insight
        return NextResponse.json({
          success: true,
          insights: [result],
          generatedAt: new Date().toISOString(),
        } as InsightsResponse, { status: 200 })
      }

      return NextResponse.json(
        { success: true, insights: [], generatedAt: new Date().toISOString() } as InsightsResponse,
        { status: 200 }
      )

    } catch (error) {
      console.error("[Insights API] POST Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as InsightsResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

export { getHandler as GET, postHandler as POST }
