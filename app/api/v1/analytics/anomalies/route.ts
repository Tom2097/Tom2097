import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { detectAnomalies, checkForAnomaly, getAnomalyStatistics } from "@/lib/analytics/anomaly-detection"
import type { DetectedAnomaly, AnomalyDetectionOptions } from "@/lib/analytics/anomaly-detection"

/**
 * GET /api/v1/analytics/anomalies
 * Detect anomalies for a specific metric and time period.
 * 
 * Query parameters:
 * - metric: The metric to analyze (required)
 * - start: Start date in ISO format (default: 30 days ago)
 * - end: End date in ISO format (default: today)
 * - methods: Comma-separated list of detection methods (zscore,iqr,mad,rolling_avg,seasonal_decomposition,ai)
 * - sensitivity: Sensitivity multiplier (default: 2.5)
 * - minConfidence: Minimum confidence threshold (default: 70)
 * - useAI: Whether to use AI detection (default: false)
 * 
 * Response:
 * {
 *   "success": boolean
 *   "anomalies": DetectedAnomaly[]
 *   "summary": { total: number; byMethod: object; bySeverity: object; byType: object }
 * }
 */

interface AnomaliesRequest {
  metric?: string
  start?: string
  end?: string
  methods?: string[]
  sensitivity?: number
  minConfidence?: number
  useAI?: boolean
}

interface AnomaliesResponse {
  success: boolean
  anomalies?: DetectedAnomaly[]
  summary?: { total: number; byMethod: Record<string, number>; bySeverity: Record<string, number>; byType: Record<string, number> }
  statistics?: {
    totalAnomalies: number
    anomalyRate: number
    avgDeviation: number
    mostCommonType: string | null
    mostSevere: string | null
    trend: "increasing" | "decreasing" | "stable"
  }
  error?: string
}

const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse query parameters
      const { searchParams } = new URL(req.url)
      
      const metric = searchParams.get("metric")
      const start = searchParams.get("start")
      const end = searchParams.get("end")
      const methods = searchParams.get("methods")?.split(",") || []
      const sensitivity = searchParams.get("sensitivity") ? parseFloat(searchParams.get("sensitivity")!) : undefined
      const minConfidence = searchParams.get("minConfidence") ? parseInt(searchParams.get("minConfidence")!) : undefined
      const useAI = searchParams.get("useAI")?.toLowerCase() === "true"

      // Validate required parameters
      if (!metric) {
        return NextResponse.json(
          { success: false, error: "metric parameter is required" } as AnomaliesResponse,
          { status: 400 }
        )
      }

      // Build date range
      let dateRange: { start: string; end: string }
      if (start && end) {
        dateRange = { start, end }
      } else {
        // Default to last 30 days
        const endDate = new Date().toISOString()
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        dateRange = { start: startDate, end: endDate }
      }

      // Build options
      const options: AnomalyDetectionOptions = {}
      if (methods.length > 0) options.methods = methods as any[]
      if (sensitivity !== undefined) options.sensitivity = sensitivity
      if (minConfidence !== undefined) options.minConfidence = minConfidence
      if (useAI !== undefined) options.useAI = useAI

      // Detect anomalies
      const result = await detectAnomalies(organizationId, metric, dateRange, options)

      // Get statistics
      const statistics = await getAnomalyStatistics(organizationId, metric, dateRange, options)

      const response: AnomaliesResponse = {
        success: true,
        anomalies: result.anomalies,
        summary: result.summary,
        statistics,
      }

      return NextResponse.json(response, { status: 200 })

    } catch (error) {
      console.error("[Anomalies API] Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as AnomaliesResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

/**
 * POST /api/v1/analytics/anomalies
 * Check a specific data point for anomalies or get statistics.
 * 
 * Request body:
 * {
 *   "action": "check" | "statistics",
 *   "metric": string - The metric to analyze
 *   "value": number - The value to check (for "check" action)
 *   "timestamp": string - The timestamp to check (for "check" action)
 *   "dateRange"?: { start: string; end: string } - For "statistics" action
 *   "options"?: AnomalyDetectionOptions
 * }
 * 
 * Response:
 * For "check": { success: boolean; anomaly?: DetectedAnomaly; isAnomaly: boolean }
 * For "statistics": { success: boolean; statistics: {...} }
 */

interface AnomaliesPostRequest {
  action: "check" | "statistics"
  metric: string
  value?: number
  timestamp?: string
  dateRange?: { start: string; end: string }
  options?: AnomalyDetectionOptions
}

interface CheckAnomalyResponse {
  success: boolean
  isAnomaly: boolean
  anomaly?: DetectedAnomaly
  error?: string
}

interface StatisticsResponse {
  success: boolean
  statistics?: {
    totalAnomalies: number
    anomalyRate: number
    avgDeviation: number
    mostCommonType: string | null
    mostSevere: string | null
    trend: "increasing" | "decreasing" | "stable"
  }
  error?: string
}

type PostResponse = CheckAnomalyResponse | StatisticsResponse

const postHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse request body
      let body: AnomaliesPostRequest
      try {
        body = await req.json()
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" } as PostResponse,
          { status: 400 }
        )
      }

      // Validate action
      if (!body.action || !["check", "statistics"].includes(body.action)) {
        return NextResponse.json(
          { success: false, error: "action must be 'check' or 'statistics'" } as PostResponse,
          { status: 400 }
        )
      }

      // Validate metric
      if (!body.metric) {
        return NextResponse.json(
          { success: false, error: "metric is required" } as PostResponse,
          { status: 400 }
        )
      }

      if (body.action === "check") {
        // Validate required fields for check
        if (body.value === undefined || body.timestamp === undefined) {
          return NextResponse.json(
            { success: false, error: "value and timestamp are required for 'check' action" } as PostResponse,
            { status: 400 }
          )
        }

        // Check for anomaly
        const anomaly = await checkForAnomaly(
          organizationId,
          body.metric,
          body.value,
          body.timestamp,
          body.options || {}
        )

        const response: CheckAnomalyResponse = {
          success: true,
          isAnomaly: anomaly !== null,
          anomaly: anomaly || undefined,
        }

        return NextResponse.json(response, { status: 200 })

      } else if (body.action === "statistics") {
        // Validate date range
        if (!body.dateRange) {
          return NextResponse.json(
            { success: false, error: "dateRange is required for 'statistics' action" } as PostResponse,
            { status: 400 }
          )
        }

        // Get statistics
        const statistics = await getAnomalyStatistics(
          organizationId,
          body.metric,
          body.dateRange,
          body.options || {}
        )

        const response: StatisticsResponse = {
          success: true,
          statistics,
        }

        return NextResponse.json(response, { status: 200 })
      }

      return NextResponse.json(
        { success: false, error: "Invalid action" } as PostResponse,
        { status: 400 }
      )

    } catch (error) {
      console.error("[Anomalies API] POST Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as PostResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

export { getHandler as GET, postHandler as POST }
