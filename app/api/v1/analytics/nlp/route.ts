import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  analyzeText,
  analyzeSentiment,
  extractEntities,
  classifyText,
  extractKeywords,
  generateSummary,
  detectIntent,
  detectToxicity,
  detectLanguage,
  analyzeTextComprehensively,
  analyzeDocuments,
} from "@/lib/analytics/nlp"
import type {
  NLPAnalysisResult,
  NLPAnalysisOptions,
  TextAnalysisType,
  TextDocument,
} from "@/lib/analytics/nlp"

/**
 * POST /api/v1/analytics/nlp
 * Perform NLP analysis on text.
 * 
 * Request body:
 * {
 *   "text": "string - Text to analyze (required)",
 *   "analysisType": "sentiment" | "entities" | "classification" | "keywords" | "summary" | "intent" | "toxicity" | "language" | "comprehensive",
 *   "options"?: {
 *     "entities"?: EntityType[],
 *     "classificationCategories"?: string[],
 *     "keywords"?: string[],
 *     "summaryLength"?: "short" | "medium" | "long",
 *     "model"?: string,
 *     "temperature"?: number,
 *     "maxOutputTokens"?: number
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": boolean
 *   "result": NLPAnalysisResult
 *   "processingTime": number
 * }
 */

interface NLPRequest {
  text: string
  analysisType?: TextAnalysisType
  options?: Partial<NLPAnalysisOptions>
  documents?: TextDocument[]
}

interface NLPResponse {
  success: boolean
  result?: NLPAnalysisResult | {
    documents: Array<{ id: string; result: NLPAnalysisResult }>
    aggregate: any
  }
  processingTime?: number
  error?: string
}

const postHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse request body
      let body: NLPRequest
      try {
        body = await req.json()
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" } as NLPResponse,
          { status: 400 }
        )
      }

      // Validate required fields
      if (!body.text && !body.documents) {
        return NextResponse.json(
          { success: false, error: "Either 'text' or 'documents' is required" } as NLPResponse,
          { status: 400 }
        )
      }

      const startTime = Date.now()

      // Handle single text analysis
      if (body.text) {
        const analysisType = body.analysisType || "comprehensive"
        const options: NLPAnalysisOptions = {
          analysisType,
          ...body.options,
        }

        const result = await analyzeText(body.text, options)
        const processingTime = Date.now() - startTime

        return NextResponse.json({
          success: true,
          result,
          processingTime,
        } as NLPResponse, { status: 200 })
      }

      // Handle multiple documents analysis
      if (body.documents && body.documents.length > 0) {
        const analysisType = body.analysisType || "comprehensive"
        const options: NLPAnalysisOptions = {
          analysisType,
          ...body.options,
        }

        const result = await analyzeDocuments(body.documents, options)
        const processingTime = Date.now() - startTime

        return NextResponse.json({
          success: true,
          result,
          processingTime,
        } as NLPResponse, { status: 200 })
      }

      return NextResponse.json(
        { success: false, error: "No text or documents provided" } as NLPResponse,
        { status: 400 }
      )

    } catch (error) {
      console.error("[NLP API] Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { success: false, error: errorMessage } as NLPResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

/**
 * GET /api/v1/analytics/nlp
 * Get supported analysis types and options.
 */
const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      return NextResponse.json({
        success: true,
        analysisTypes: [
          "sentiment",
          "entities",
          "classification",
          "keywords",
          "summary",
          "intent",
          "toxicity",
          "language",
          "comprehensive",
        ],
        entityTypes: [
          "PERSON",
          "ORGANIZATION",
          "LOCATION",
          "DATE",
          "TIME",
          "MONEY",
          "PERCENT",
          "EMAIL",
          "PHONE",
          "URL",
          "ADDRESS",
        ],
        classificationCategories: [
          "business",
          "technology",
          "health",
          "sports",
          "entertainment",
          "politics",
          "finance",
          "legal",
          "education",
          "travel",
          "food",
          "lifestyle",
          "science",
        ],
        intentTypes: [
          "question",
          "command",
          "statement",
          "request",
          "complaint",
          "compliment",
          "information_seeking",
          "action_required",
          "feedback",
        ],
        summaryLengths: ["short", "medium", "long"],
        sentimentTypes: ["positive", "negative", "neutral", "mixed"],
      }, { status: 200 })

    } catch (error) {
      console.error("[NLP API] GET Error:", error)
      
      return NextResponse.json(
        { success: false, error: "Failed to get NLP options" } as NLPResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

export { getHandler as GET, postHandler as POST }
