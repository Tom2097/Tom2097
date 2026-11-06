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

// Checked with string literals removed, so a keyword inside a value can't
// trigger these and a value can't hide anything from them.
const BLOCKED_PATTERNS = [
  /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|COPY|CALL|DO|SET|INTO|MERGE|VACUUM|LOCK|TABLE)\b/i,
  /\b(pg_\w+|information_schema|dblink\w*|lo_\w+|current_setting|set_config|query_to_xml\w*|table_to_xml\w*|schema_to_xml\w*|database_to_xml\w*)\b/i,
  /--|\/\*|;|"|\$/,
]

const TABLE_WHITELIST = [
  "analytics_events",
  "analytics_event_timeseries",
  "documents",
  "crm_contacts",
  "crm_deals",
  "accounts_payable",
  "assets",
  "compliance_audits",
  "capa_records",
  "okr_objectives",
  "okr_key_results",
]

/** Every table named after FROM or JOIN. Subqueries are picked up by their own FROM. */
function referencedTables(sql: string): string[] {
  // These use FROM as syntax rather than to name a table.
  const normalized = sql
    .replace(/\b(EXTRACT|SUBSTRING|TRIM|OVERLAY)\s*\([^()]*\)/gi, "0")
    .replace(/\bDISTINCT\s+FROM\b/gi, "= ")

  const tables: string[] = []
  const fromClause =
    /\bFROM\s+([\s\S]*?)(?=\b(?:SELECT|FROM|WHERE|GROUP|ORDER|LIMIT|OFFSET|HAVING|WINDOW|FETCH|UNION|INTERSECT|EXCEPT|JOIN|CROSS|INNER|LEFT|RIGHT|FULL|NATURAL|ON|USING)\b|\)|$)/gi
  for (const match of normalized.matchAll(fromClause)) {
    for (const item of match[1].split(",")) {
      const name = item.trim().split(/\s+/)[0]
      if (name && !name.startsWith("(")) tables.push(name)
    }
  }
  for (const match of normalized.matchAll(/\bJOIN\s+([^\s(]+)/gi)) {
    tables.push(match[1])
  }
  return tables
}

/**
 * Rejects generated SQL that isn't a plain read of allowed tables. This is only
 * a first filter: pattern checks cannot prove a query stays inside one tenant
 * (`OR 1=1` passes them), so passing it must never be enough to run a query
 * with elevated privileges. See the text-to-sql route.
 */
export function guardQuery(sql: string): GuardedQuery {
  const reject = (reason: string): GuardedQuery => ({ sql, params: {}, allowed: false, reason })

  const trimmed = sql.trim().replace(/;\s*$/, "")
  if (!ALLOWED_PATTERNS.some((p) => p.test(trimmed))) {
    return reject("Only SELECT queries are allowed")
  }

  const withoutStrings = trimmed.replace(/'(?:[^']|'')*'/g, "''")
  if (BLOCKED_PATTERNS.some((p) => p.test(withoutStrings))) {
    return reject("Query contains blocked patterns (DROP, DELETE, INSERT, etc.)")
  }

  const cteNames = new Set(
    [...withoutStrings.matchAll(/\b(\w+)\s+AS\s*(?:(?:NOT\s+)?MATERIALIZED\s*)?\(/gi)].map((m) => m[1].toLowerCase()),
  )
  const tables = referencedTables(withoutStrings)
    .map((t) => t.toLowerCase())
    .filter((t) => !cteNames.has(t))

  if (tables.length === 0) {
    return reject("Query does not read from an allowed table")
  }
  const disallowed = tables.find((t) => !TABLE_WHITELIST.includes(t))
  if (disallowed) {
    return reject(`Table '${disallowed}' is not in the allowed list`)
  }
  if (!/\borganization_id\b/i.test(withoutStrings)) {
    return reject("Query is not scoped to an organization")
  }

  return { sql: trimmed, params: {}, allowed: true, reason: "Read-only query allowed" }
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
- crm_contacts: columns(id, first_name, last_name, name, email, phone, company_id, status, organization_id)
- crm_deals: columns(id, title, value, stage, expected_close_date, owner_id, organization_id)
- accounts_payable: columns(id, vendor, amount, status, due_date, organization_id)
- assets: columns(id, name, category, status, location, organization_id)
- capa_records: columns(id, title, severity, status, assigned_to, sla_deadline, organization_id)

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
