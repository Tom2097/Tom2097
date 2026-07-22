import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { executeNaturalLanguageQuery, getQuerySuggestions } from "@/lib/analytics/ai-query"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/ai-query
 *
 * Example natural-language questions, for building a suggestions UI. No AI call.
 */
export const GET = withAuth(
  async () => {
    return NextResponse.json({ success: true, data: { suggestions: getQuerySuggestions() } })
  },
  { requireAll: ["analytics:read"] },
)

/**
 * POST /api/v1/analytics/ai-query
 *
 * Ask a natural-language question about the organization's analytics data.
 * The question is converted to a structured query via an LLM and executed
 * against the analytics engine.
 * Body: { question, availableEvents?: string[], dateRange?: { start, end } }
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ success: false, error: "question is required" }, { status: 400 })
    }

    // Always calls generateText -- meter it per tenant like every other
    // LLM-calling route (forecast.ts).
    const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
    if (rateLimited) return rateLimited

    try {
      const result = await executeNaturalLanguageQuery(context.organizationId, body.question, {
        availableEvents: Array.isArray(body.availableEvents) ? body.availableEvents : undefined,
        dateRange: body.dateRange,
      })
      return NextResponse.json({ success: true, data: result })
    } catch (error) {
      logger.logError("[API] Error running AI query:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to run AI query" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
