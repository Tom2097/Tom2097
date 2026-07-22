import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import {
  generateReport,
  generateCustomReport,
  generateFormattedReport,
  getAllTemplates,
  type ReportOptions,
} from "@/lib/analytics/ai-reports"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/ai-report
 *
 * List available report templates (no AI call, safe to poll for building UI).
 */
export const GET = withAuth(
  async () => {
    return NextResponse.json({ success: true, data: { templates: getAllTemplates() } })
  },
  { requireAll: ["analytics:read"] },
)

/**
 * POST /api/v1/analytics/ai-report
 *
 * Generate an AI-written analytics report.
 * Body: { customPrompt?, format?, type?, period?, focusMetrics?, includeSections?,
 *          excludeSections?, templateId?, includeData?, depth?, tone? }
 * If `format` is one of markdown/html/plain, returns the rendered report as
 * text (Content-Type set accordingly); otherwise returns the structured
 * GeneratedReport JSON.
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => ({}))
    const { customPrompt, format, ...options } = body as ReportOptions & { customPrompt?: string }

    // Every branch below calls generateText/streamText at least once --
    // meter it per tenant like every other LLM-calling route (forecast.ts).
    const rateLimited = await checkTenantRateLimit(context.tenantId, 100, 10)
    if (rateLimited) return rateLimited

    try {
      if (format && format !== "json") {
        const rendered = await generateFormattedReport(context.organizationId, format, options)
        const contentType = format === "html" ? "text/html" : "text/plain"
        return new NextResponse(rendered, { headers: { "Content-Type": `${contentType}; charset=utf-8` } })
      }

      const report = customPrompt
        ? await generateCustomReport(context.organizationId, customPrompt, options)
        : await generateReport(context.organizationId, options)

      return NextResponse.json({ success: true, data: report })
    } catch (error) {
      logger.logError("[API] Error generating AI report:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
