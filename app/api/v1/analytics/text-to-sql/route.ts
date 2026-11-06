import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { textToSql, textToAnalyticsQuery, guardQuery } from "@/lib/analytics/text-to-sql"
import { logger } from "@/lib/logging"

/**
 * POST /api/v1/analytics/text-to-sql
 *
 * Convert a natural-language question into SQL (or a semantic analytics
 * query). Body: { question, mode?: "sql" | "analytics", context?: { table?, schema? } }.
 *
 * This route only generates SQL and never runs it. Tenant scoping in generated
 * SQL is just an instruction to the model, and a user's question can talk it out
 * of that, so running the result with the service role would expose other
 * tenants' data. Execution needs a database role limited to one tenant by RLS.
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ success: false, error: "question is required" }, { status: 400 })
    }

    if (body.execute === true) {
      return NextResponse.json({ success: false, error: "SQL execution is not available" }, { status: 501 })
    }

    // Both modes call generateText -- meter it per tenant like every other
    // LLM-calling route (forecast.ts).
    const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
    if (rateLimited) return rateLimited

    try {
      if (body.mode === "analytics") {
        const result = await textToAnalyticsQuery(body.question, context.organizationId)
        return NextResponse.json({ success: true, data: result })
      }

      const result = await textToSql(body.question, context.organizationId, body.context)

      if (!result.sql || result.confidence === 0) {
        return NextResponse.json({ success: true, data: { ...result, canExecute: false } })
      }

      const guarded = guardQuery(result.sql)
      return NextResponse.json({
        success: true,
        data: { ...result, canExecute: false, ...(guarded.allowed ? {} : { reason: guarded.reason }) },
      })
    } catch (error) {
      logger.logError("[API] Error in text-to-sql:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to convert text to SQL" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
