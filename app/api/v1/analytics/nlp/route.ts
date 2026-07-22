import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { analyzeText, analyzeDocuments, type NLPAnalysisOptions, type TextDocument } from "@/lib/analytics/nlp"
import { logger } from "@/lib/logging"

const VALID_ANALYSIS_TYPES = [
  "sentiment",
  "entities",
  "classification",
  "keywords",
  "summary",
  "intent",
  "toxicity",
  "language",
  "comprehensive",
]

/**
 * GET /api/v1/analytics/nlp
 *
 * Returns the supported analysis types (for building a picker UI). No AI call.
 */
export const GET = withAuth(
  async () => {
    return NextResponse.json({ success: true, data: { analysisTypes: VALID_ANALYSIS_TYPES } })
  },
  { requireAll: ["analytics:read"] },
)

/**
 * POST /api/v1/analytics/nlp
 *
 * Run NLP text analysis (sentiment, entities, classification, keywords,
 * summary, intent, toxicity, language, or comprehensive).
 * Body: { text, analysisType, ...options } | { documents: TextDocument[], analysisType, ...options }
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body || !VALID_ANALYSIS_TYPES.includes(body.analysisType)) {
      return NextResponse.json(
        { success: false, error: `analysisType must be one of: ${VALID_ANALYSIS_TYPES.join(", ")}` },
        { status: 400 },
      )
    }

    // Every analysis type calls generateText -- meter it per tenant like
    // every other LLM-calling route (forecast.ts).
    const rateLimited = await checkTenantRateLimit(context.tenantId, 300, 30)
    if (rateLimited) return rateLimited

    const options: NLPAnalysisOptions = {
      analysisType: body.analysisType,
      entities: body.entities,
      classificationCategories: body.classificationCategories,
      keywords: body.keywords,
      summaryLength: body.summaryLength,
      temperature: body.temperature,
      maxOutputTokens: body.maxOutputTokens,
    }

    try {
      if (Array.isArray(body.documents)) {
        const documents = body.documents as TextDocument[]
        if (documents.length === 0 || documents.length > 50) {
          return NextResponse.json({ success: false, error: "documents must contain 1-50 items" }, { status: 400 })
        }
        const result = await analyzeDocuments(documents, options)
        return NextResponse.json({ success: true, data: result })
      }

      if (typeof body.text !== "string" || !body.text.trim()) {
        return NextResponse.json({ success: false, error: "text is required" }, { status: 400 })
      }

      const result = await analyzeText(body.text, options)
      return NextResponse.json({ success: true, data: result })
    } catch (error) {
      logger.logError("[API] Error running NLP analysis:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to analyze text" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)
