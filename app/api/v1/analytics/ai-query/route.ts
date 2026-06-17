import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { executeNaturalLanguageQuery, getQuerySuggestions, validateAIQuery } from "@/lib/analytics/ai-query"
import type { ParsedAIQuery } from "@/lib/analytics/ai-query"

/**
 * POST /api/v1/analytics/ai-query
 * Execute a natural language analytics query.
 * 
 * Request body:
 * {
 *   "question": "string - The natural language question to analyze"
 *   "context"?: {
 *     "availableEvents"?: string[] - List of known event types
 *     "dateRange"?: { start: string; end: string } - Suggested date range
 *   }
 * }
 * 
 * Response:
 * {
 *   "query": ParsedAIQuery - The structured query that was executed
 *   "result": { type: string; points?: TimeseriesPoint[]; rows?: BreakdownRow[]; summary?: AnalyticsSummary }
 *   "explanation": string - Human-readable explanation of what was executed
 * }
 */

interface AIQueryRequest {
  question: string
  context?: {
    availableEvents?: string[]
    dateRange?: { start: string; end: string }
  }
}

interface AIQueryResponse {
  success: boolean
  query?: ParsedAIQuery
  result?: {
    type: string
    points?: any[]
    rows?: any[]
    summary?: any
  }
  explanation?: string
  error?: string
  suggestions?: string[]
}

const handler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Parse request body
      let body: AIQueryRequest
      try {
        body = await req.json()
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" } as AIQueryResponse,
          { status: 400 }
        )
      }

      // Validate required fields
      if (!body.question || typeof body.question !== "string" || !body.question.trim()) {
        return NextResponse.json(
          { 
            success: false, 
            error: "question is required and must be a non-empty string",
            suggestions: getQuerySuggestions()
          } as AIQueryResponse,
          { status: 400 }
        )
      }

      // Execute the natural language query
      const result = await executeNaturalLanguageQuery(
        organizationId,
        body.question,
        body.context
      )

      // Validate the query for safety
      const validation = validateAIQuery(result.query)
      if (!validation.valid) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid query: ${validation.error}`,
            query: result.query,
            suggestions: getQuerySuggestions()
          } as AIQueryResponse,
          { status: 400 }
        )
      }

      const response: AIQueryResponse = {
        success: true,
        query: result.query,
        result: result.result,
        explanation: result.explanation,
      }

      return NextResponse.json(response, { status: 200 })

    } catch (error) {
      console.error("[AI Query API] Error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          suggestions: getQuerySuggestions()
        } as AIQueryResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

export { handler as POST }

// Support GET for suggestions only
const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      const suggestions = getQuerySuggestions()
      
      return NextResponse.json({
        success: true,
        suggestions,
      }, { status: 200 })
    } catch (error) {
      console.error("[AI Query API] Error getting suggestions:", error)
      return NextResponse.json(
        { success: false, error: "Failed to get query suggestions" },
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

export { getHandler as GET }
