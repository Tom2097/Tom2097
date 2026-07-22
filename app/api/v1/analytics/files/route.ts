import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import {
  getUploadedFiles,
  processUploadedFile,
  randomUUID,
  type AnalysisType,
  type FileAnalysisOptions,
} from "@/lib/analytics/file-upload"
import { logger } from "@/lib/logging"

const VALID_ANALYSIS_TYPES: AnalysisType[] = [
  "text_extraction",
  "data_analysis",
  "document_summary",
  "entity_extraction",
  "sentiment_analysis",
  "custom_prompt",
]

/**
 * GET /api/v1/analytics/files
 *
 * List previously uploaded/analyzed files for the caller's organization.
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined
    const status = searchParams.get("status") ?? undefined
    const analysisType = searchParams.get("analysisType") ?? undefined

    try {
      const files = await getUploadedFiles(context.organizationId, {
        limit,
        offset,
        status,
        analysisType: analysisType as AnalysisType | undefined,
      })
      return NextResponse.json({ success: true, data: files })
    } catch (error) {
      logger.logError("[API] Error listing uploaded files:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to list files" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)

/**
 * POST /api/v1/analytics/files
 *
 * Upload a file (as inline text content) and run AI-powered analysis on it.
 * Body: { filename, content, contentType, size, analysisType, options? }
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.filename !== "string" || typeof body.content !== "string") {
      return NextResponse.json(
        { success: false, error: "filename and content are required" },
        { status: 400 },
      )
    }

    const analysisType: AnalysisType = VALID_ANALYSIS_TYPES.includes(body.analysisType)
      ? body.analysisType
      : "data_analysis"

    // analyzeFile always makes a generateText call, so meter it per tenant
    // like every other LLM-calling route (app/api/chat, ai/crm-query, forecast).
    const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
    if (rateLimited) return rateLimited

    try {
      const options: Partial<FileAnalysisOptions> = body.options ?? {}
      const file = await processUploadedFile(
        context.organizationId,
        context.userId,
        {
          id: randomUUID(),
          filename: body.filename,
          originalFilename: body.originalFilename ?? body.filename,
          content: body.content,
          contentType: body.contentType ?? "text/plain",
          size: Number(body.size) || body.content.length,
        },
        analysisType,
        options,
      )
      return NextResponse.json({ success: true, data: file }, { status: 201 })
    } catch (error) {
      logger.logError("[API] Error processing uploaded file:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to process file" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:write"] },
)
