import { generateText } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, FAST_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { buildSemanticSql } from "@/lib/analytics/semantic-layer"
import type { SemanticQuery } from "@/lib/analytics/semantic-layer"

export interface TextToSqlResult {
  sql: string
  explanation: string
  confidence: number
  query: SemanticQuery | null
}

export interface GuardedQuery {
  sql: string
  params: Record<string, unknown>
  allowed: boolean
  reason: string
}

const ALLOWED_PATTERNS = [
  /^SELECT\s/i,
  /^WITH\s/i,
]

const BLOCKED_PATTERNS = [
  /DROP\s/i,
  /DELETE\s/i,
  /INSERT\s/i,
  /UPDATE\s/i,
  /ALTER\s/i,
  /CREATE\s/i,
  /TRUNCATE\s/i,
  /GRANT\s/i,
  /REVOKE\s/i,
  /EXEC\s/i,
  /INTO\s+i?[Oo][Uu][Tt][Ff][Ii][Ll][Ee]/,
  /INTO\s+OUTFILE/i,
  /LOAD\s+DATA/i,
  /LOAD_FILE\s*\(/i,
  /SLEEP\s*\(/i,
  /BENCHMARK\s*\(/i,
  /;\s*DROP/i,
  /;\s*DELETE/i,
  /;\s*INSERT/i,
  /;\s*UPDATE/i,
]

const TABLE_WHITELIST = [
  "analytics_events",
  "analytics_event_timeseries",
  "documents",
  "profiles",
  "organizations",
  "contacts",
  "deals",
  "accounts_payable",
  "assets",
  "compliance_audits",
  "compliance_capas",
  "performance_objectives",
  "performance_key_results",
]

export function guardQuery(sql: string): GuardedQuery {
  const isSelect = ALLOWED_PATTERNS.some((p) => p.test(sql))
  if (!isSelect) {
    return { sql, params: {}, allowed: false, reason: "Only SELECT queries are allowed" }
  }

  const isBlocked = BLOCKED_PATTERNS.some((p) => p.test(sql))
  if (isBlocked) {
    return { sql, params: {}, allowed: false, reason: "Query contains blocked patterns (DROP, DELETE, INSERT, etc.)" }
  }

  for (const table of TABLE_WHITELIST) {
    if (sql.toLowerCase().includes(table.toLowerCase())) {
      return { sql, params: {}, allowed: true, reason: "Query references allowed table" }
    }
  }

  const tableRef = sql.match(/\bFROM\s+(\w+)/i)?.[1]
  if (tableRef && !TABLE_WHITELIST.includes(tableRef.toLowerCase())) {
    return { sql, params: {}, allowed: false, reason: `Table '${tableRef}' is not in the allowed list` }
  }

  return { sql, params: {}, allowed: true, reason: "Read-only query allowed" }
}

export async function textToSql(
  question: string,
  organizationId: string,
  context?: { table?: string; schema?: string },
): Promise<TextToSqlResult> {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a Text-to-SQL engine. Convert natural language questions into SQL queries.
The database is a Postgres analytics warehouse with these tables:
- analytics_events: columns(event_name, event_properties JSONB, user_id, session_id, timestamp, organization_id)
- analytics_event_timeseries: columns(date, event_name, count, organization_id)
- documents: columns(id, name, type, content, classification, status, created_at, organization_id)
- contacts: columns(id, name, email, phone, company, status, organization_id)
- deals: columns(id, name, amount, stage, close_date, owner_id, organization_id)
- accounts_payable: columns(id, vendor, amount, status, due_date, organization_id)
- assets: columns(id, name, type, status, location, organization_id)
- compliance_capas: columns(id, title, severity, status, assigned_to, due_date, organization_id)

Rules:
1. Always add "WHERE organization_id = '${organizationId}'" to scope queries
2. Use valid PostgreSQL syntax
3. Limit results to 1000 rows max
4. Return ONLY valid JSON: { "sql": "the SQL query", "explanation": "brief explanation", "confidence": 0-100 }

Example question: "How many documents were created last month?"
Example response: { "sql": "SELECT COUNT(*) FROM documents WHERE organization_id = '${organizationId}' AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE)", "explanation": "Counts documents created in the previous calendar month", "confidence": 95 }`

  try {
    const result = await generateText({
      model: FAST_MODEL,
      system: systemPrompt,
      prompt: `Question: ${question}\n${context?.table ? `Table context: ${context.table}\nSchema: ${context.schema ?? "standard"}` : ""}\n\nConvert to SQL:`,
      temperature: 0.1,
      maxOutputTokens: 1000,
    })

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { sql: "", explanation: "Failed to parse SQL output", confidence: 0, query: null }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const guarded = guardQuery(parsed.sql)

    if (!guarded.allowed) {
      return { sql: parsed.sql, explanation: guarded.reason, confidence: 0, query: null }
    }

    return {
      sql: parsed.sql,
      explanation: parsed.explanation ?? "Generated from natural language",
      confidence: parsed.confidence ?? 70,
      query: null,
    }
  } catch (error) {
    return { sql: "", explanation: `Error: ${(error as Error).message}`, confidence: 0, query: null }
  }
}

export async function textToAnalyticsQuery(
  question: string,
  organizationId: string,
): Promise<{
  query: SemanticQuery | null
  sql: string
  explanation: string
}> {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a natural language to analytics query converter.
Given a question about data, extract the analytics parameters.
Return ONLY a JSON object:
{
  "event_name": "string (the event/metric name)",
  "aggregate": "count|sum|avg|min|max",
  "granularity": "hour|day|week|month",
  "filters": [{ "field": "string", "op": "eq|neq|gt|gte|lt|lte|contains", "value": "string" }],
  "group_by": ["column_name"],
  "limit": number,
  "explanation": "brief description"
}`

  try {
    const result = await generateText({
      model: FAST_MODEL,
      system: systemPrompt,
      prompt: `Question: ${question}\n\nExtract analytics query parameters:`,
      temperature: 0.1,
      maxOutputTokens: 1000,
    })

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Failed to parse")

    const parsed = JSON.parse(jsonMatch[0])

    const query: SemanticQuery = {
      metrics: [parsed.event_name ?? question],
      dimensions: parsed.group_by ?? [],
      filters: (parsed.filters ?? []).map((f: { field?: string; op?: string; value?: unknown }) => ({
        dimension: f.field ?? "",
        operator: f.op ?? "eq",
        value: f.value,
      })),
      limit: parsed.limit ?? 100,
    }

    const sql = buildSemanticSql(query, [], [], organizationId)

    return { query, sql, explanation: parsed.explanation ?? "" }
  } catch (error) {
    return { query: null, sql: "", explanation: `Error: ${(error as Error).message}` }
  }
}
