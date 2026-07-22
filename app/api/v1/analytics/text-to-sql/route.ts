import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { textToSql, textToAnalyticsQuery, guardQuery } from "@/lib/analytics/text-to-sql"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

/**
 * POST /api/v1/analytics/text-to-sql
 *
 * Convert a natural-language question into SQL (or a semantic analytics
 * query). Body: { question, mode?: "sql" | "analytics", context?: { table?, schema? },
 * execute?: boolean }.
 *
 * Generated SQL is never run automatically -- `execute: true` is required,
 * and even then it's re-validated through guardQuery() (SELECT-only,
 * table-whitelisted) before being run via the same service-role-only
 * `execute_sql` RPC that lib/analytics/elt.ts already uses.
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ success: false, error: "question is required" }, { status: 400 })
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
      if (!guarded.allowed) {
        return NextResponse.json({
          success: true,
          data: { ...result, canExecute: false, reason: guarded.reason },
        })
      }

      if (body.execute !== true) {
        return NextResponse.json({ success: true, data: { ...result, canExecute: true } })
      }

      const db = createServiceClient()
      const { data, error } = await db.rpc("execute_sql", { query_text: guarded.sql })
      if (error) {
        return NextResponse.json(
          { success: false, error: `SQL execution failed: ${error.message}`, data: { ...result, canExecute: true } },
          { status: 400 },
        )
      }

      return NextResponse.json({ success: true, data: { ...result, canExecute: true, rows: data ?? [] } })
    } catch (error) {
      logger.logError("[API] Error in text-to-sql:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to convert text to SQL" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
