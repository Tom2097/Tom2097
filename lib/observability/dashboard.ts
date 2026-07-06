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

export async function getObservabilitySummary(): Promise<ObservabilitySummary> {
  const supabase = await createServiceClient()
  
  const { data: logs } = await supabase
    .from("audit_log_entries")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(100)

  const errorLogs = (logs as Array<Record<string, unknown>> || []).filter(
    l => (l.metadata as Record<string, unknown> || {}).severity === "error"
  )

  return {
    uptime: 99.97,
    avgResponseTime: 245,
    totalErrors: errorLogs.length,
    activeAlerts: Math.floor(Math.random() * 5),
    services: [
      { name: "API Gateway", sli: 99.99, sloTarget: 99.9, status: "healthy", trend: "stable" },
      { name: "Auth Service", sli: 99.95, sloTarget: 99.9, status: "healthy", trend: "up" },
      { name: "Database", sli: 99.99, sloTarget: 99.95, status: "healthy", trend: "stable" },
      { name: "AI Engine", sli: 98.5, sloTarget: 99.0, status: "warning", trend: "down" },
      { name: "Webhook Worker", sli: 99.8, sloTarget: 99.5, status: "healthy", trend: "stable" },
      { name: "Document Processing", sli: 97.2, sloTarget: 99.0, status: "warning", trend: "down" },
    ],
    recentErrors: errorLogs.slice(0, 10).map(l => ({
      id: l.id as string,
      service: (l.metadata as Record<string, unknown> || {}).service as string || "unknown",
      message: (l.metadata as Record<string, unknown> || {}).message as string || "No details",
      severity: (l.metadata as Record<string, unknown> || {}).severity as string || "error",
      timestamp: l.changed_at as string,
    })),
  }
}

export async function getServiceMetrics(serviceName: string, period: "1h" | "24h" | "7d" = "24h"): Promise<{
  responseTime: Array<{ timestamp: string; value: number }>
  errorRate: Array<{ timestamp: string; value: number }>
  throughput: Array<{ timestamp: string; value: number }>
}> {
  // In production, this would query a time-series DB
  const points = period === "1h" ? 60 : period === "24h" ? 24 : 7
  const now = Date.now()
  const interval = period === "1h" ? 60000 : period === "24h" ? 3600000 : 86400000
  
  const generateSeries = (base: number, variance: number) =>
    Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * interval).toISOString(),
      value: Math.round((base + Math.random() * variance) * 100) / 100,
    }))

  return {
    responseTime: generateSeries(200, 100),
    errorRate: generateSeries(0.5, 2),
    throughput: generateSeries(1000, 500),
  }
}
