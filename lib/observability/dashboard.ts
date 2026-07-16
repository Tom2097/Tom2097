"use server"

import { createServiceClient } from "@/lib/supabase/service"

export interface ServiceLevelIndicator {
  name: string
  sli: number // 0-100
  sloTarget: number
  status: "healthy" | "warning" | "critical"
  trend: "up" | "down" | "stable"
}

export interface ObservabilitySummary {
  uptime: number // percentage
  avgResponseTime: number // ms
  totalErrors: number
  activeAlerts: number
  services: ServiceLevelIndicator[]
  recentErrors: Array<{
    id: string
    service: string
    message: string
    severity: string
    timestamp: string
  }>
}

const MONITOR_TYPES = ["http", "heartbeat", "tcp", "internal"] as const
const TYPE_LABELS: Record<(typeof MONITOR_TYPES)[number], string> = {
  http: "HTTP Endpoints",
  heartbeat: "Heartbeat Checks",
  tcp: "TCP Services",
  internal: "Internal Checks",
}

function sliOf(checks: Array<{ status: string }>): number {
  if (checks.length === 0) return 100
  const up = checks.filter((c) => c.status === "up").length
  return Math.round((up / checks.length) * 10000) / 100
}

/**
 * Aggregates real, platform-wide signals from the monitors/monitor_checks/
 * incidents tables (module #21) instead of a hardcoded fake service list.
 * These start empty until organizations actually configure monitors -- an
 * honest "no data yet" beats fabricated precision numbers.
 */
export async function getObservabilitySummary(): Promise<ObservabilitySummary> {
  const db = createServiceClient()

  const { data: logs } = await db
    .from("audit_log_entries")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(100)

  const errorLogs = (logs as Array<Record<string, unknown>> || []).filter(
    l => (l.metadata as Record<string, unknown> || {}).severity === "error"
  )

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data: allChecks } = await db
    .from("monitor_checks")
    .select("status, latency_ms, checked_at, monitor_id")
    .gte("checked_at", thirtyDaysAgo)

  const checks = allChecks ?? []
  const uptime = sliOf(checks)
  const latencies = checks.map((c) => c.latency_ms).filter((v): v is number => v != null)
  const avgResponseTime = latencies.length > 0 ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0

  const { count: activeAlerts } = await db
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "investigating", "identified", "monitoring"])

  const services: ServiceLevelIndicator[] = []
  for (const type of MONITOR_TYPES) {
    const { data: monitors } = await db.from("monitors").select("id").eq("type", type)
    const ids = new Set((monitors ?? []).map((m) => m.id))
    if (ids.size === 0) continue

    const typeChecks = checks.filter((c) => ids.has(c.monitor_id))
    if (typeChecks.length === 0) continue

    const sli = sliOf(typeChecks)
    const recent = typeChecks.filter((c) => c.checked_at >= sevenDaysAgo)
    const prior = typeChecks.filter((c) => c.checked_at < sevenDaysAgo)
    const recentSli = recent.length > 0 ? sliOf(recent) : sli
    const priorSli = prior.length > 0 ? sliOf(prior) : sli
    const trend = recentSli > priorSli + 0.5 ? "up" : recentSli < priorSli - 0.5 ? "down" : "stable"
    const status = sli >= 99.5 ? "healthy" : sli >= 98 ? "warning" : "critical"

    services.push({ name: TYPE_LABELS[type], sli, sloTarget: 99.9, status, trend })
  }

  return {
    uptime,
    avgResponseTime,
    totalErrors: errorLogs.length,
    activeAlerts: activeAlerts ?? 0,
    services,
    recentErrors: errorLogs.slice(0, 10).map(l => ({
      id: l.id as string,
      service: (l.metadata as Record<string, unknown> || {}).service as string || "unknown",
      message: (l.metadata as Record<string, unknown> || {}).message as string || "No details",
      severity: (l.metadata as Record<string, unknown> || {}).severity as string || "error",
      timestamp: l.changed_at as string,
    })),
  }
}

const REVERSE_TYPE_LABELS = Object.fromEntries(
  Object.entries(TYPE_LABELS).map(([type, label]) => [label, type]),
) as Record<string, (typeof MONITOR_TYPES)[number]>

export async function getServiceMetrics(serviceName: string, period: "1h" | "24h" | "7d" = "24h"): Promise<{
  responseTime: Array<{ timestamp: string; value: number }>
  errorRate: Array<{ timestamp: string; value: number }>
  throughput: Array<{ timestamp: string; value: number }>
}> {
  const db = createServiceClient()
  const type = REVERSE_TYPE_LABELS[serviceName]
  const points = period === "1h" ? 60 : period === "24h" ? 24 : 7
  const now = Date.now()
  const interval = period === "1h" ? 60000 : period === "24h" ? 3600000 : 86400000
  const since = new Date(now - points * interval).toISOString()

  const empty = { responseTime: [], errorRate: [], throughput: [] }
  if (!type) return empty

  const { data: monitors } = await db.from("monitors").select("id").eq("type", type)
  const ids = (monitors ?? []).map((m) => m.id)
  if (ids.length === 0) return empty

  const { data: checks } = await db
    .from("monitor_checks")
    .select("status, latency_ms, checked_at")
    .in("monitor_id", ids)
    .gte("checked_at", since)
    .order("checked_at", { ascending: true })

  const rows = checks ?? []
  const buckets = Array.from({ length: points }, (_, i) => {
    const bucketStart = now - (points - i) * interval
    const bucketEnd = bucketStart + interval
    return rows.filter((c) => {
      const t = new Date(c.checked_at).getTime()
      return t >= bucketStart && t < bucketEnd
    })
  })

  return {
    responseTime: buckets.map((b, i) => {
      const lat = b.map((c) => c.latency_ms).filter((v): v is number => v != null)
      return { timestamp: new Date(now - (points - i) * interval).toISOString(), value: lat.length ? Math.round(lat.reduce((s, v) => s + v, 0) / lat.length) : 0 }
    }),
    errorRate: buckets.map((b, i) => ({
      timestamp: new Date(now - (points - i) * interval).toISOString(),
      value: b.length ? Math.round(((b.length - b.filter((c) => c.status === "up").length) / b.length) * 10000) / 100 : 0,
    })),
    throughput: buckets.map((b, i) => ({
      timestamp: new Date(now - (points - i) * interval).toISOString(),
      value: b.length,
    })),
  }
}
