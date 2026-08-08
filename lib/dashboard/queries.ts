import { createServiceClient } from "@/lib/supabase/service"

/**
 * Live data access for the operational dashboards. Every query is scoped to the
 * caller's organizationId (resolved upstream via extractTenantContext) and runs
 * through the service-role client, so cross-tenant ids simply return no rows
 * rather than leaking. These read the pre-aggregated `dashboard_stats` and
 * `analytics_metrics` tables — there are no mock generators involved.
 */

export interface DashboardStats {
  ai_accuracy: number
  enterprise_clients: number
  data_streams: number
  uptime: number
  response_time: number
  active_operations: number
}

export interface RevenuePoint {
  [key: string]: string | number
  name: string
  value: number
  actual: number
  forecast: number
}

export interface OperationalPoint {
  [key: string]: string | number
  name: string
  value: number
  cpu: number
  memory: number
  network: number
}

export interface RiskPoint {
  name: string
  value: number
  threshold: number
}

interface MetricRow {
  label: string | null
  value: number | string | null
  actual: number | string | null
  forecast: number | string | null
  threshold: number | string | null
  cpu: number | string | null
  memory: number | string | null
  network: number | string | null
  date: string | null
}

const num = (v: number | string | null): number => {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) ? n : 0
}

/**
 * Seed rows can contain duplicates per (date,label). Keep the first occurrence
 * so charts render a clean, ordered series.
 */
function dedupe(rows: MetricRow[]): MetricRow[] {
  const seen = new Set<string>()
  const out: MetricRow[] = []
  for (const r of rows) {
    const key = `${r.date ?? ""}|${r.label ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

export async function getDashboardStats(organizationId: string): Promise<DashboardStats | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("dashboard_stats")
    .select("ai_accuracy, enterprise_clients, data_streams, uptime, response_time, active_operations, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.log("[v0] getDashboardStats failed:", error.message)
    return null
  }
  if (!data) return null
  return {
    ai_accuracy: num(data.ai_accuracy),
    enterprise_clients: num(data.enterprise_clients),
    data_streams: num(data.data_streams),
    uptime: num(data.uptime),
    response_time: num(data.response_time),
    active_operations: num(data.active_operations),
  }
}

async function getMetrics(organizationId: string, metricType: string): Promise<MetricRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("analytics_metrics")
    .select("label, value, actual, forecast, threshold, cpu, memory, network, date")
    .eq("organization_id", organizationId)
    .eq("metric_type", metricType)
    .order("date", { ascending: true })
  if (error) {
    console.log(`[v0] getMetrics(${metricType}) failed:`, error.message)
    return []
  }
  return dedupe((data ?? []) as MetricRow[])
}

export async function getRevenueMetrics(organizationId: string): Promise<RevenuePoint[]> {
  const rows = await getMetrics(organizationId, "revenue")
  return rows.map((r) => ({
    name: r.label ?? "",
    value: num(r.value),
    actual: num(r.actual),
    forecast: num(r.forecast),
  }))
}

export async function getOperationalMetrics(organizationId: string): Promise<OperationalPoint[]> {
  const rows = await getMetrics(organizationId, "operational")
  return rows.map((r) => ({
    name: r.label ?? "",
    value: num(r.value),
    cpu: num(r.cpu),
    memory: num(r.memory),
    network: num(r.network),
  }))
}

export async function getRiskMetrics(organizationId: string): Promise<RiskPoint[]> {
  const rows = await getMetrics(organizationId, "risk")
  return rows.map((r) => ({
    name: r.label ?? "",
    value: num(r.value),
    threshold: num(r.threshold),
  }))
}

/**
 * Real message counts backing the dashboard's "Communication Volume" card --
 * counts `documents` rows ingested from a messaging source (WhatsApp/email)
 * in the last 7 days, the same `metadata->>source` convention used by
 * app/api/v1/operations/metrics/route.ts's whatsappMessages/emailMessages
 * counters.
 */
export async function getCommunicationVolume(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await db
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .or("metadata->>source.eq.whatsapp,metadata->>source.eq.email,metadata->>source.eq.email_attachment")
    .gte("created_at", sevenDaysAgo)
  if (error) {
    console.log("[v0] getCommunicationVolume failed:", error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Real document count backing the dashboard's "Document Processing" card --
 * all `documents` rows ingested for the org since the start of the current
 * calendar month, regardless of source.
 */
export async function getDocumentsProcessedThisMonth(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count, error } = await db
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", startOfMonth)
  if (error) {
    console.log("[v0] getDocumentsProcessedThisMonth failed:", error.message)
    return 0
  }
  return count ?? 0
}
