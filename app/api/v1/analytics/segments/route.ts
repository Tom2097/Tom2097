import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import {
  segmentCustomers,
  getCustomerSegment,
  getSegmentComparison,
  getRFMDistribution,
  type SegmentationOptions,
} from "@/lib/analytics/customer-segments"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/segments
 *
 * RFM-based customer segmentation.
 * ?view=segments (default) | comparison | distribution
 * ?userId= scopes to a single customer's segment (any view).
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view") ?? "segments"
    const userId = searchParams.get("userId")
    const useAI = searchParams.get("useAI") === "true"

    const options: SegmentationOptions = {
      lookbackDays: searchParams.get("lookbackDays") ? Number(searchParams.get("lookbackDays")) : undefined,
      minMonetaryValue: searchParams.get("minMonetaryValue") ? Number(searchParams.get("minMonetaryValue")) : undefined,
      events: searchParams.get("events") ? searchParams.get("events")!.split(",").map((e) => e.trim()).filter(Boolean) : undefined,
      useAI,
    }

    if (useAI) {
      // segmentCustomers calls generateText per segment when useAI is on --
      // meter it per tenant like every other LLM-calling route (forecast.ts).
      const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
      if (rateLimited) return rateLimited
    }

    try {
      if (userId) {
        const result = await getCustomerSegment(context.organizationId, userId, options)
        return NextResponse.json({ success: true, data: result })
      }

      if (view === "comparison") {
        const result = await getSegmentComparison(context.organizationId, options)
        return NextResponse.json({ success: true, data: result })
      }

      if (view === "distribution") {
        const result = await getRFMDistribution(context.organizationId, options)
        return NextResponse.json({ success: true, data: result })
      }

      const result = await segmentCustomers(context.organizationId, options)
      return NextResponse.json({ success: true, data: result })
    } catch (error) {
      logger.logError("[API] Error computing customer segments:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to compute segments" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
