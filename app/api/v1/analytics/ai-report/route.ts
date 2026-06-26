import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { 
  generateReport, 
  generateFormattedReport,
  streamReport,
  generateCustomReport,
  getReportTemplate,
  getAllTemplates,
  formatReport
} from "@/lib/analytics/ai-reports"
import type { GeneratedReport, ReportOptions, ReportFormat, ReportType, ReportSectionType } from "@/lib/analytics/ai-reports"

/**
 * GET /api/v1/analytics/ai-report
 * Generate an AI-powered analytics report.
 * 
 * Query parameters:
 * - type: Report type (daily_summary, weekly_summary, monthly_summary, performance_report, customer_analysis, trend_analysis, anomaly_report, segment_analysis, custom)
 * - format: Output format (markdown, html, json, plain) (default: markdown)
 * - start: Start date in ISO format (default: 30 days ago)
 * - end: End date in ISO format (default: today)
 * - focusMetrics: Comma-separated list of metrics to focus on
 * - templateId: Template ID to use
 * - depth: Depth of analysis (brief, standard, comprehensive)
 * - tone: Tone of the report (professional, casual, technical, executive)
 * - includeData: Whether to include raw data (default: false)
 * - includeSections: Comma-separated list of sections to include
 * - excludeSections: Comma-separated list of sections to exclude
 * 
 * Response:
 * { report: GeneratedReport } or formatted string based on format parameter
 */

interface ReportRequest {
  type?: ReportType
  format?: ReportFormat
  start?: string
  end?: string
  focusMetrics?: string[]
  templateId?: string
  depth?: "brief" | "standard" | "comprehensive"
  tone?: "professional" | "casual" | "technical" | "executive"
  includeData?: boolean
  includeSections?: string[]
  excludeSections?: string[]
}

interface ReportResponse {
  success: boolean
  report?: GeneratedReport | string
  error?: string
}

const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse query parameters
      const { searchParams } = new URL(req.url)
      
      const type = searchParams.get("type") as ReportType || undefined
      const format = searchParams.get("format") as ReportFormat || "markdown"
      const start = searchParams.get("start") || undefined
      const end = searchParams.get("end") || undefined
      const focusMetrics = searchParams.get("focusMetrics")?.split(",") || []
      const templateId = searchParams.get("templateId") || undefined
      const depth = searchParams.get("depth") as "brief" | "standard" | "comprehensive" || undefined
      const tone = searchParams.get("tone") as "professional" | "casual" | "technical" | "executive" || undefined
      const includeData = searchParams.get("includeData")?.toLowerCase() === "true"
      const includeSections = searchParams.get("includeSections")?.split(",") || []
      const excludeSections = searchParams.get("excludeSections")?.split(",") || []

      const options: ReportOptions = {}
      if (type) options.type = type
      if (format) options.format = format
      if (start && end) options.period = { start, end }
      if (focusMetrics.length > 0) options.focusMetrics = focusMetrics
      if (templateId) options.templateId = templateId
      if (depth) options.depth = depth
      if (tone) options.tone = tone
      if (includeData !== undefined) options.includeData = includeData
      if (includeSections.length > 0) options.includeSections = includeSections as ReportSectionType[]
      if (excludeSections.length > 0) options.excludeSections = excludeSections as ReportSectionType[]

      // Generate report
      if (format === "json") {
        // For JSON format, return the full report object
        const report = await generateReport(organizationId, options)
        return NextResponse.json({ success: true, report }, { status: 200 })
      } else {
        // For other formats, return the formatted string
        const report = await generateFormattedReport(organizationId, format, options)
        return new NextResponse(report, {
          headers: { "Content-Type": getContentType(format) },
          status: 200,
        })
      }

    } catch (error) {
      console.error("[AI Report API] Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as ReportResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

/**
 * POST /api/v1/analytics/ai-report
 * Generate a report with a custom prompt or stream a report.
 * 
 * Request body:
 * {
 *   "action": "generate" | "custom" | "format" | "stream",
 *   "type"?: string,
 *   "format"?: ReportFormat,
 *   "period"?: { start: string; end: string },
 *   "focusMetrics"?: string[],
 *   "customPrompt"?: string - For "custom" action
 *   "options"?: ReportOptions
 * }
 * 
 * Response:
 * - For "generate", "custom", "format": { success: boolean; report: GeneratedReport | string }
 * - For "stream": Streaming response
 */

interface ReportPostRequest {
  action: "generate" | "custom" | "format" | "stream" | "templates" | "template"
  type?: ReportType
  format?: ReportFormat
  period?: { start: string; end: string }
  focusMetrics?: string[]
  customPrompt?: string
  templateId?: string
  options?: ReportOptions
}

const postHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse request body
      let body: ReportPostRequest
      try {
        body = await req.json()
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" } as ReportResponse,
          { status: 400 }
        )
      }

      // Validate action
      if (!body.action || !["generate", "custom", "format", "stream", "templates", "template"].includes(body.action)) {
        return NextResponse.json(
          { success: false, error: "action must be 'generate', 'custom', 'format', 'stream', 'templates', or 'template'" } as ReportResponse,
          { status: 400 }
        )
      }

      const options = body.options || {}

      switch (body.action) {
        case "generate":
          if (body.format === "json") {
            const generatedReport = await generateReport(organizationId, { ...options, type: body.type })
            return NextResponse.json({ success: true, report: generatedReport }, { status: 200 })
          } else {
            const formattedReport = await generateFormattedReport(
              organizationId,
              body.format || "markdown",
              { ...options, type: body.type }
            )
            return new NextResponse(formattedReport, {
              headers: { "Content-Type": getContentType(body.format || "markdown") },
              status: 200,
            })
          }

        case "custom":
          if (!body.customPrompt) {
            return NextResponse.json(
              { success: false, error: "customPrompt is required for 'custom' action" } as ReportResponse,
              { status: 400 }
            )
          }

          const customReport = await generateCustomReport(
            organizationId,
            body.customPrompt,
            { ...options, format: body.format }
          )

          if (body.format === "json") {
            return NextResponse.json({ success: true, report: customReport }, { status: 200 })
          } else {
            const formatted = formatReport(customReport, body.format || "markdown")
            return new NextResponse(formatted, {
              headers: { "Content-Type": getContentType(body.format || "markdown") },
              status: 200,
            })
          }

        case "format":
          if (!body.format) {
            return NextResponse.json(
              { success: false, error: "format is required for 'format' action" } as ReportResponse,
              { status: 400 }
            )
          }

          const report = await generateReport(organizationId, options)
          const formatted = formatReport(report, body.format)
          
          return new NextResponse(formatted, {
            headers: { "Content-Type": getContentType(body.format) },
            status: 200,
          })

        case "stream":
          // Handle streaming response
          const stream = streamReport(organizationId, { ...options, type: body.type })
          
          const responseStream = new ReadableStream({
            async start(controller) {
              for await (const chunk of stream) {
                controller.enqueue(new TextEncoder().encode(chunk))
              }
              controller.close()
            },
          })

          return new NextResponse(responseStream, {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            status: 200,
          })

        case "templates":
          const templates = getAllTemplates()
          return NextResponse.json({ success: true, templates }, { status: 200 })

        case "template":
          if (!body.templateId) {
            return NextResponse.json(
              { success: false, error: "templateId is required for 'template' action" } as ReportResponse,
              { status: 400 }
            )
          }

          const template = getReportTemplate(body.templateId)
          if (!template) {
            return NextResponse.json(
              { success: false, error: `Template '${body.templateId}' not found` } as ReportResponse,
              { status: 404 }
            )
          }

          return NextResponse.json({ success: true, template }, { status: 200 })

        default:
          return NextResponse.json(
            { success: false, error: "Invalid action" } as ReportResponse,
            { status: 400 }
          )
      }

    } catch (error) {
      console.error("[AI Report API] POST Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as ReportResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

/**
 * Helper to get content type for format
 */
function getContentType(format: ReportFormat): string {
  switch (format) {
    case "json":
      return "application/json"
    case "html":
      return "text/html; charset=utf-8"
    case "plain":
      return "text/plain; charset=utf-8"
    case "markdown":
    default:
      return "text/markdown; charset=utf-8"
  }
}

export { getHandler as GET, postHandler as POST }
