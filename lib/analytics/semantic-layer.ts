import { createServiceClient } from "@/lib/supabase/service"

export interface MetricDefinition {
  id: string
  organization_id: string
  name: string
  description: string | null
  sql_expression: string
  domain: string
  aggregate: "sum" | "avg" | "count" | "min" | "max" | "count_distinct"
  dimensions: string[]
  filters: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DimensionDefinition {
  id: string
  organization_id: string
  name: string
  description: string | null
  sql_expression: string
  domain: string
  type: "string" | "number" | "date" | "boolean"
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SemanticQuery {
  metrics: string[]
  dimensions: string[]
  filters?: Array<{ dimension: string; operator: string; value: unknown }>
  start?: string
  end?: string
  limit?: number
  offset?: number
}

export async function listMetrics(organizationId: string): Promise<MetricDefinition[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("semantic_metrics")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name")
  return (data ?? []) as MetricDefinition[]
}

export async function listDimensions(organizationId: string): Promise<DimensionDefinition[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("semantic_dimensions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name")
  return (data ?? []) as DimensionDefinition[]
}

export async function createMetric(
  organizationId: string,
  userId: string,
  input: Omit<MetricDefinition, "id" | "organization_id" | "created_by" | "created_at" | "updated_at">,
): Promise<MetricDefinition | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("semantic_metrics")
    .insert({ ...input, organization_id: organizationId, created_by: userId })
    .select("*")
    .single()
  if (error) return null
  return data as MetricDefinition
}

export async function createDimension(
  organizationId: string,
  userId: string,
  input: Omit<DimensionDefinition, "id" | "organization_id" | "created_by" | "created_at" | "updated_at">,
): Promise<DimensionDefinition | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("semantic_dimensions")
    .insert({ ...input, organization_id: organizationId, created_by: userId })
    .select("*")
    .single()
  if (error) return null
  return data as DimensionDefinition
}

export function buildSemanticSql(
  query: SemanticQuery,
  metrics: MetricDefinition[],
  dimensions: DimensionDefinition[],
  organizationId?: string,
): string {
  const metricExprs = query.metrics.map((m) => {
    const def = metrics.find((d) => d.name === m)
    if (!def) return `0 AS ${m}`
    switch (def.aggregate) {
      case "count_distinct": return `COUNT(DISTINCT ${def.sql_expression}) AS ${def.name}`
      case "sum": return `SUM(${def.sql_expression}) AS ${def.name}`
      case "avg": return `AVG(${def.sql_expression}) AS ${def.name}`
      case "min": return `MIN(${def.sql_expression}) AS ${def.name}`
      case "max": return `MAX(${def.sql_expression}) AS ${def.name}`
      default: return `COUNT(${def.sql_expression}) AS ${def.name}`
    }
  })

  const dimExprs = query.dimensions.map((d) => {
    const def = dimensions.find((x) => x.name === d)
    return def ? def.sql_expression : d
  })

  const selectExprs = [...dimExprs, ...metricExprs]
  const groupBy = dimExprs.length > 0 ? `GROUP BY ${dimExprs.join(", ")}` : ""

  const whereClauses: string[] = []
  if (organizationId) whereClauses.push(`organization_id = '${organizationId}'`)

  if (query.filters) {
    for (const f of query.filters) {
      const val = typeof f.value === "string" ? `'${f.value}'` : String(f.value)
      whereClauses.push(`${f.dimension} ${f.operator} ${val}`)
    }
  }

  if (query.start) whereClauses.push(`occurred_at >= '${query.start}'`)
  if (query.end) whereClauses.push(`occurred_at < '${query.end}'`)

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""

  return `SELECT ${selectExprs.join(", ")} FROM analytics_events ${where} ${groupBy} LIMIT ${query.limit ?? 100} OFFSET ${query.offset ?? 0}`
}
