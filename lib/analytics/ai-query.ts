import { generateText } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { runQuery } from "./engine"
import type { AnalyticsQuery, QueryType, AggregateFn, Granularity, TimeseriesPoint, BreakdownRow, AnalyticsSummary } from "./types"

/**
 * Module #7.1: AI-Powered Natural Language Querying.
 * 
 * Converts natural language questions about analytics into structured
 * query parameters, then executes the query against the analytics engine.
 * Uses LLM to understand intent and map to the appropriate query type.
 */

// Schema for the LLM to return structured query parameters
const querySchema = z.object({
  type: z.enum(["timeseries", "breakdown", "summary"] as const),
  event_name: z.string().nullable().optional(),
  event_category: z.string().nullable().optional(),
  aggregate: z.enum(["count", "sum", "avg", "min", "max"] as const).optional(),
  granularity: z.enum(["hour", "day", "week", "month"] as const).optional(),
  dimension: z.string().optional(),
  start: z.string().describe("ISO date string for start of range"),
  end: z.string().describe("ISO date string for end of range"),
  limit: z.number().int().min(1).max(100).optional(),
})

type ParsedAIQuery = z.infer<typeof querySchema>

/**
 * System prompt for natural language query understanding.
 * Guides the LLM to extract query parameters from user questions.
 */
const NLQ_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are an expert at understanding business analytics questions and converting them to structured queries.
Your task is to analyze the user's natural language question and extract the query parameters needed to answer it.

AVAILABLE QUERY TYPES:
- "timeseries": Show metrics over time (e.g., "show me daily active users", "user signups over time")
- "breakdown": Show distribution by a dimension (e.g., "show me revenue by product", "users by country")
- "summary": Show aggregate totals (e.g., "total revenue", "how many users do I have")

AVAILABLE AGGREGATES: count, sum, avg, min, max
AVAILABLE GRANULARITIES: hour, day, week, month
AVAILABLE DIMENSIONS: event_name, event_category, source, session_id, user_id, or any property key

RESPONSE FORMAT:
Return ONLY a JSON object with the following structure:
{
  "type": "timeseries" | "breakdown" | "summary",
  "event_name": string | null,
  "event_category": string | null,
  "aggregate": "count" | "sum" | "avg" | "min" | "max",
  "granularity": "hour" | "day" | "week" | "month",
  "dimension": string (for breakdown only),
  "start": "YYYY-MM-DD" or ISO date string,
  "end": "YYYY-MM-DD" or ISO date string,
  "limit": number between 1-100 (for breakdown only)
}

GUIDELINES:
- Use "count" as the default aggregate for event-based questions
- Use "sum" for revenue, value, or monetary questions
- Use "avg" for average calculations
- For timeseries without explicit granularity, use "day"
- For questions about "yesterday", "last week", "this month", calculate appropriate date ranges
- Today's date: use current date for calculations
- Always provide both start and end dates
- For "all time" questions, use a wide range like 365 days or more
- Be smart about interpreting relative time references
- If the user mentions specific events (e.g., "purchases", "signups"), use those as event_name
- If uncertain, make reasonable assumptions and use count aggregate

EXAMPLES:
User: "Show me daily active users for the last 30 days"
Output: {"type": "timeseries", "event_name": "active_user", "aggregate": "count", "granularity": "day", "start": "2024-01-01", "end": "2024-01-31"}

User: "What's my total revenue this month?"
Output: {"type": "summary", "event_name": "purchase", "aggregate": "sum", "start": "2024-01-01", "end": "2024-01-31"}

User: "Break down sales by product category"
Output: {"type": "breakdown", "event_name": "purchase", "aggregate": "sum", "dimension": "product_category", "start": "2024-01-01", "end": "2024-01-31"}

REMEMBER: Return ONLY the JSON object, no explanations, no markdown, just the JSON.`

/**
 * Parse natural language query into structured AnalyticsQuery
 * Uses LLM to understand intent and extract parameters
 */
export async function parseNaturalLanguageQuery(
  organizationId: string,
  question: string,
  context?: {
    availableEvents?: string[]
    dateRange?: { start: string; end: string }
  }
): Promise<ParsedAIQuery> {
  // Build the user prompt with context
  let userPrompt = `User question: "${question}"`
  
  if (context?.availableEvents && context.availableEvents.length > 0) {
    userPrompt += `\n\nKnown event types in this organization: ${context.availableEvents.join(", ")}`
  }
  
  if (context?.dateRange) {
    userPrompt += `\n\nSuggested date range: ${context.dateRange.start} to ${context.dateRange.end}`
  }

  // Generate structured query using LLM
  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: NLQ_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.2, // Low temperature for more deterministic output
    maxOutputTokens: 1000,
  })

  // Parse the LLM response
  try {
    // Try to extract JSON from the response
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      throw new Error("No JSON found in LLM response")
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    return querySchema.parse(parsed)
  } catch (error) {
    console.error("[AI Query] Failed to parse LLM response:", error)
    
    // Fallback: create a reasonable default query based on the question
    const defaultQuery = createFallbackQuery(question)
    return querySchema.parse(defaultQuery)
  }
}

/**
 * Create a fallback query when LLM parsing fails
 * Uses simple keyword matching to determine query type
 */
function createFallbackQuery(question: string): ParsedAIQuery {
  const lowerQuestion = question.toLowerCase()
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  // Determine query type
  let type: QueryType = "summary"
  if (lowerQuestion.includes("over time") || lowerQuestion.includes("trend") || 
      lowerQuestion.includes("daily") || lowerQuestion.includes("weekly") ||
      lowerQuestion.includes("monthly") || lowerQuestion.includes("by day") ||
      lowerQuestion.includes("by week") || lowerQuestion.includes("by month")) {
    type = "timeseries"
  } else if (lowerQuestion.includes("by") || lowerQuestion.includes("breakdown") || 
             lowerQuestion.includes("group by") || lowerQuestion.includes("distribution")) {
    type = "breakdown"
  }
  
  // Determine aggregate
  let aggregate: AggregateFn = "count"
  if (lowerQuestion.includes("revenue") || lowerQuestion.includes("sales") || 
      lowerQuestion.includes("total") && (lowerQuestion.includes("money") || lowerQuestion.includes("$"))) {
    aggregate = "sum"
  } else if (lowerQuestion.includes("average") || lowerQuestion.includes("avg")) {
    aggregate = "avg"
  }
  
  // Determine granularity for timeseries
  let granularity: Granularity | undefined
  if (type === "timeseries") {
    if (lowerQuestion.includes("hour") || lowerQuestion.includes("hourly")) {
      granularity = "hour"
    } else if (lowerQuestion.includes("week") || lowerQuestion.includes("weekly")) {
      granularity = "week"
    } else if (lowerQuestion.includes("month") || lowerQuestion.includes("monthly")) {
      granularity = "month"
    } else {
      granularity = "day"
    }
  }
  
  // Try to extract event name
  let event_name: string | null = null
  const eventKeywords = ["signups", "signup", "users", "user", "purchases", "purchase", 
                        "revenue", "orders", "order", "visits", "visit", "views", "view",
                        "clicks", "click", "conversions", "conversion"]
  
  for (const keyword of eventKeywords) {
    if (lowerQuestion.includes(keyword)) {
      event_name = keyword
      break
    }
  }
  
  // Build the query
  const query: ParsedAIQuery = {
    type,
    event_name,
    aggregate,
    start: thirtyDaysAgo,
    end: today,
  }
  
  if (granularity) {
    query.granularity = granularity
  }
  
  if (type === "breakdown") {
    query.dimension = "event_name"
    query.limit = 10
  }
  
  return query
}

/**
 * Execute a natural language query and return results
 * Parses the question, converts to structured query, and runs it
 */
export async function executeNaturalLanguageQuery(
  organizationId: string,
  question: string,
  context?: {
    availableEvents?: string[]
    dateRange?: { start: string; end: string }
  }
): Promise<{
  query: ParsedAIQuery
  result: {
    type: QueryType
    points?: TimeseriesPoint[]
    rows?: BreakdownRow[]
    summary?: AnalyticsSummary
  }
  explanation: string
}> {
  // Parse the natural language query
  const query = await parseNaturalLanguageQuery(organizationId, question, context)
  
  // Execute the query using the existing engine
  const result = await runQuery(organizationId, query as AnalyticsQuery)
  
  // Generate a brief explanation of what was executed
  const explanation = generateQueryExplanation(question, query)
  
  return {
    query,
    result,
    explanation,
  }
}

/**
 * Generate a human-readable explanation of the executed query
 */
function generateQueryExplanation(question: string, query: ParsedAIQuery): string {
  const parts: string[] = []
  
  parts.push(`Interpreted your question: "${question}"`)
  
  switch (query.type) {
    case "timeseries":
      parts.push(`as a time series analysis`)
      if (query.event_name) {
        parts.push(`tracking "${query.event_name}"`)
      }
      if (query.aggregate) {
        parts.push(`using ${query.aggregate} aggregation`)
      }
      if (query.granularity) {
        parts.push(`with ${query.granularity} granularity`)
      }
      break
    
    case "breakdown":
      parts.push(`as a breakdown analysis`)
      if (query.event_name) {
        parts.push(`of "${query.event_name}"`)
      }
      if (query.dimension) {
        parts.push(`grouped by ${query.dimension}`)
      }
      if (query.aggregate) {
        parts.push(`using ${query.aggregate}`)
      }
      break
    
    case "summary":
      parts.push(`as a summary`)
      if (query.event_name) {
        parts.push(`for "${query.event_name}"`)
      }
      if (query.aggregate) {
        parts.push(`using ${query.aggregate}`)
      }
      break
  }
  
  parts.push(`from ${query.start} to ${query.end}`)
  
  return parts.join(" ")
}

/**
 * Validate that a parsed query is safe to execute
 * Ensures date ranges are reasonable and parameters are valid
 */
export function validateAIQuery(query: ParsedAIQuery): { valid: boolean; error?: string } {
  // Validate date range
  try {
    const startDate = new Date(query.start)
    const endDate = new Date(query.end)
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { valid: false, error: "Invalid date format" }
    }
    
    if (startDate >= endDate) {
      return { valid: false, error: "Start date must be before end date" }
    }
    
    // Limit date range to prevent excessive queries
    const maxDays = 730 // 2 years
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysDiff > maxDays) {
      return { valid: false, error: `Date range too large (max ${maxDays} days)` }
    }
    
    // Validate limit for breakdown queries
    if (query.type === "breakdown" && query.limit && (query.limit < 1 || query.limit > 100)) {
      return { valid: false, error: "Limit must be between 1 and 100" }
    }
    
    return { valid: true }
  } catch (error) {
    return { valid: false, error: `Invalid query: ${error}` }
  }
}

/**
 * Get suggestions for refining a natural language query
 * Helps users understand what questions they can ask
 */
export function getQuerySuggestions(): string[] {
  return [
    "Show me daily active users for the last 30 days",
    "What's my total revenue this month?",
    "Break down sales by product category",
    "Show me user signups over time",
    "What's the average order value?",
    "Show me conversions by source",
    "What's my most popular product?",
    "Show me monthly revenue trends",
    "How many users signed up yesterday?",
    "Break down traffic by country",
  ]
}

export type { ParsedAIQuery }
