import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { 
  segmentCustomers, 
  getCustomerSegment, 
  getRFMDistribution,
  createCustomSegments,
  getSegmentComparison
} from "@/lib/analytics/customer-segments"
import type { CustomerProfile, SegmentDefinition, SegmentResult, SegmentationOptions } from "@/lib/analytics/customer-segments"

/**
 * GET /api/v1/analytics/segments
 * Get customer segments for an organization.
 * 
 * Query parameters:
 * - lookbackDays: Number of days to look back (default: 365)
 * - useAI: Whether to include AI insights (default: true)
 * - autoSegment: Whether to auto-generate segments (default: true)
 * - focusMetrics: Comma-separated list of metrics to focus on
 * 
 * Response:
 * {
 *   "success": boolean
 *   "segments": SegmentResult[]
 *   "totalCustomers": number
 *   "summary": { segments: number; avgCustomersPerSegment: number; topSegment: string }
 * }
 */

interface SegmentsRequest {
  lookbackDays?: number
  useAI?: boolean
  autoSegment?: boolean
  focusMetrics?: string[]
}

interface SegmentsResponse {
  success: boolean
  segments?: SegmentResult[]
  totalCustomers?: number
  summary?: { segments: number; avgCustomersPerSegment: number; topSegment: string }
  error?: string
}

const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse query parameters
      const { searchParams } = new URL(req.url)
      
      const lookbackDays = searchParams.get("lookbackDays") 
        ? parseInt(searchParams.get("lookbackDays")!) 
        : undefined
      const useAI = searchParams.get("useAI")?.toLowerCase() === "true" ? true : 
                   searchParams.get("useAI")?.toLowerCase() === "false" ? false : 
                   undefined
      const autoSegment = searchParams.get("autoSegment")?.toLowerCase() === "true" ? true : 
                          searchParams.get("autoSegment")?.toLowerCase() === "false" ? false : 
                          undefined
      const focusMetrics = searchParams.get("focusMetrics")?.split(",") || []

      const options: SegmentationOptions = {}
      if (lookbackDays !== undefined) options.lookbackDays = lookbackDays
      if (useAI !== undefined) options.useAI = useAI
      if (autoSegment !== undefined) options.autoSegment = autoSegment
      if (focusMetrics.length > 0) options.events = focusMetrics

      // Get segments
      const result = await segmentCustomers(organizationId, options)

      const response: SegmentsResponse = {
        success: true,
        segments: result.segments,
        totalCustomers: result.totalCustomers,
        summary: result.summary,
      }

      return NextResponse.json(response, { status: 200 })

    } catch (error) {
      console.error("[Segments API] Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as SegmentsResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

/**
 * POST /api/v1/analytics/segments
 * Get a specific customer's segment or create custom segments.
 * 
 * Request body:
 * {
 *   "action": "customer" | "rfm_distribution" | "custom" | "comparison",
 *   "userId"?: string - For "customer" action
 *   "criteria"?: object[] - For "custom" action
 *   "options"?: SegmentationOptions
 * }
 * 
 * Response varies by action:
 * - "customer": { profile?: CustomerProfile; segment?: SegmentDefinition; rfmScores?: {...} }
 * - "rfm_distribution": { recency: object; frequency: object; monetary: object; cells: object }
 * - "custom": SegmentDefinition[]
 * - "comparison": { segments: [...]; overall: {...} }
 */

interface SegmentCriteria {
  field: string
  operator: string
  value: unknown
}

interface SegmentsPostRequest {
  action: "customer" | "rfm_distribution" | "custom" | "comparison"
  userId?: string
  criteria?: SegmentCriteria[]
  options?: SegmentationOptions
}

interface CustomerSegmentResponse {
  success: boolean
  profile?: CustomerProfile
  segment?: SegmentDefinition
  rfmScores?: { recencyScore: number; frequencyScore: number; monetaryScore: number }
  error?: string
}

interface RFMDistributionResponse {
  success: boolean
  distribution?: {
    recency: Record<number, number>
    frequency: Record<number, number>
    monetary: Record<number, number>
    cells: Record<string, number>
  }
  error?: string
}

interface CustomSegmentsResponse {
  success: boolean
  segments?: SegmentDefinition[]
  error?: string
}

interface ComparisonResponse {
  success: boolean
  segments?: { name: string; count: number; avgMonetary: number; retentionRate: number; churnRisk: number }[]
  overall?: { totalCustomers: number; totalMonetary: number; avgMonetary: number; avgRetentionRate: number }
  error?: string
}

type PostResponse = CustomerSegmentResponse | RFMDistributionResponse | CustomSegmentsResponse | ComparisonResponse

const postHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse request body
      let body: SegmentsPostRequest
      try {
        body = await req.json()
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" } as PostResponse,
          { status: 400 }
        )
      }

      // Validate action
      if (!body.action || !["customer", "rfm_distribution", "custom", "comparison"].includes(body.action)) {
        return NextResponse.json(
          { success: false, error: "action must be 'customer', 'rfm_distribution', 'custom', or 'comparison'" } as PostResponse,
          { status: 400 }
        )
      }

      const options = body.options || {}

      switch (body.action) {
        case "customer":
          if (!body.userId) {
            return NextResponse.json(
              { success: false, error: "userId is required for 'customer' action" } as PostResponse,
              { status: 400 }
            )
          }

          const customerResult = await getCustomerSegment(organizationId, body.userId, options)
          
          if (!customerResult) {
            return NextResponse.json(
              { success: true, message: "No segment found for this customer" } as CustomerSegmentResponse,
              { status: 200 }
            )
          }

          const customerResponse: CustomerSegmentResponse = {
            success: true,
            profile: customerResult.profile,
            segment: customerResult.segment,
            rfmScores: customerResult.rfmScores,
          }

          return NextResponse.json(customerResponse, { status: 200 })

        case "rfm_distribution":
          const rfmDistribution = await getRFMDistribution(organizationId, options)
          
          const distributionResponse: RFMDistributionResponse = {
            success: true,
            distribution: rfmDistribution,
          }

          return NextResponse.json(distributionResponse, { status: 200 })

        case "custom":
          if (!body.criteria || !Array.isArray(body.criteria)) {
            return NextResponse.json(
              { success: false, error: "criteria is required and must be an array for 'custom' action" } as PostResponse,
              { status: 400 }
            )
          }

          const customSegments = await createCustomSegments(organizationId, body.criteria as any, options)
          
          const customResponse: CustomSegmentsResponse = {
            success: true,
            segments: customSegments,
          }

          return NextResponse.json(customResponse, { status: 200 })

        case "comparison":
          const segmentComparison = await getSegmentComparison(organizationId, options)
          
          const comparisonResponse: ComparisonResponse = {
            success: true,
            segments: segmentComparison.segments,
            overall: segmentComparison.overall,
          }

          return NextResponse.json(comparisonResponse, { status: 200 })

        default:
          return NextResponse.json(
            { success: false, error: "Invalid action" } as PostResponse,
            { status: 400 }
          )
      }

    } catch (error) {
      console.error("[Segments API] POST Error:", error)
      
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
