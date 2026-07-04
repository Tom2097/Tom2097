import { createServiceClient } from "@/lib/supabase/service"
import { getLLM } from "@/lib/ai/client"
import { generateText } from "ai"
import type { MonitorCheck, IntelligenceFinding } from "./types"
import { perceive } from "./engine"
import type { PerceptionInput } from "./engine"
import { getEntitiesByModule } from "./operational-graph"

interface ModuleMonitor {
  module: string
  checkInterval: number
  lastCheck: Date | null
  check: (organizationId: string) => Promise<IntelligenceFinding[]>
}

const MODULE_MONITORS: ModuleMonitor[] = [
  {
    module: "compliance",
    checkInterval: 6 * 3600 * 1000,
    lastCheck: null,
    async check(orgId) {
      const findings: IntelligenceFinding[] = []
      const db = createServiceClient()
      const { data: certs } = await db
        .from("certificates")
        .select("id, name, expires_at")
        .eq("organization_id", orgId)
        .gte("expires_at", new Date().toISOString())
        .lte("expires_at", new Date(Date.now() + 30 * 86400000).toISOString())

      for (const cert of (certs || []) as Array<{ id: string; name: string; expires_at: string }>) {
        const daysRemaining = Math.ceil(
          (new Date(cert.expires_at).getTime() - Date.now()) / 86400000,
        )
        if (daysRemaining <= 30 && daysRemaining > 0) {
          const { finding } = await perceive({
            organizationId: orgId,
            eventType: "compliance.cert_expiring",
            sourceModule: "compliance",
            title: `Certificate expiring: ${cert.name}`,
            description: `${cert.name} expires in ${daysRemaining} days`,
            entityId: cert.id,
            entityType: "certificate",
            evidence: { daysRemaining, certName: cert.name },
            signalStrength: daysRemaining <= 7 ? 0.95 : 0.7,
          })
          findings.push(finding)
        }
      }

      const { data: gaps } = await db
        .from("compliance_gaps")
        .select("id, title, score")
        .eq("organization_id", orgId)
        .gte("score", 7)

      for (const gap of (gaps || []) as Array<{ id: string; title: string; score: number }>) {
        const { finding } = await perceive({
          organizationId: orgId,
          eventType: "compliance.gap_detected",
          sourceModule: "compliance",
          title: `Compliance gap: ${gap.title}`,
          description: `Gap score of ${gap.score}/10 requires attention`,
          entityId: gap.id,
          entityType: "compliance_gap",
          evidence: { score: gap.score },
          signalStrength: gap.score >= 8 ? 0.9 : 0.6,
        })
        findings.push(finding)
      }

      return findings
    },
  },
  {
    module: "resources",
    checkInterval: 1 * 3600 * 1000,
    lastCheck: null,
  async check(orgId: string) {
    const findings: IntelligenceFinding[] = []
    const db = createServiceClient()
    const { data: items } = await db
      .from("inventory_items")
      .select("id, name, quantity, reorder_point")
      .eq("organization_id", orgId)
      .lte("quantity", "reorder_point")

      for (const item of ((items || []) as Array<{ id: string; name: string; quantity: number; reorder_point: number }>)) {
        if (item.quantity <= item.reorder_point) {
          const { finding } = await perceive({
            organizationId: orgId,
            eventType: "resources.low_stock",
            sourceModule: "resources",
            title: `Low stock: ${item.name}`,
            description: `${item.name} has ${item.quantity} units remaining (reorder at ${item.reorder_point})`,
            entityId: item.id,
            entityType: "resource",
            evidence: { quantity: item.quantity, reorderPoint: item.reorder_point },
            signalStrength: item.quantity <= item.reorder_point * 0.5 ? 0.9 : 0.6,
          })
          findings.push(finding)
        }
      }

      const { data: assets } = await db
        .from("assets")
        .select("id, name, next_maintenance")
        .eq("organization_id", orgId)
        .lte("next_maintenance", new Date(Date.now() + 14 * 86400000).toISOString())

      for (const asset of (assets || []) as Array<{ id: string; name: string; next_maintenance: string }>) {
        const daysUntil = Math.ceil(
          (new Date(asset.next_maintenance).getTime() - Date.now()) / 86400000,
        )
        const { finding } = await perceive({
          organizationId: orgId,
          eventType: "resources.maintenance_due",
          sourceModule: "resources",
          title: `Maintenance due: ${asset.name}`,
          description: `${asset.name} requires maintenance in ${daysUntil} days`,
          entityId: asset.id,
          entityType: "asset",
          evidence: { daysUntil, assetName: asset.name },
          signalStrength: daysUntil <= 3 ? 0.9 : 0.6,
        })
        findings.push(finding)
      }

      return findings
    },
  },
  {
    module: "crm",
    checkInterval: 4 * 3600 * 1000,
    lastCheck: null,
    async check(orgId) {
      const findings: IntelligenceFinding[] = []
      const db = createServiceClient()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

      const { data: deals } = await db
        .from("deals")
        .select("id, name, value, stage, updated_at")
        .eq("organization_id", orgId)
        .eq("status", "open")
        .lt("updated_at", thirtyDaysAgo)

      for (const deal of (deals || []) as Array<{ id: string; name: string; value: number; stage: string }>) {
        const { finding } = await perceive({
          organizationId: orgId,
          eventType: "crm.pipeline_stalled",
          sourceModule: "crm",
          title: `Deal stalled: ${deal.name}`,
          description: `Deal worth $${deal.value.toLocaleString()} has not been updated in 30+ days (stage: ${deal.stage})`,
          entityId: deal.id,
          entityType: "deal",
          evidence: { value: deal.value, stage: deal.stage, daysStale: 30 },
          signalStrength: deal.value >= 50000 ? 0.85 : 0.6,
        })
        findings.push(finding)
      }

      return findings
    },
  },
  {
    module: "operations",
    checkInterval: 2 * 3600 * 1000,
    lastCheck: null,
    async check(orgId) {
      const findings: IntelligenceFinding[] = []
      const db = createServiceClient()
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()

      const { data: batches } = await db
        .from("production_batches")
        .select("id, name, throughput, expected_throughput, completed_at")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("completed_at", threeDaysAgo)

      for (const batch of (batches || []) as Array<{ id: string; name: string; throughput: number; expected_throughput: number }>) {
        if (batch.throughput < batch.expected_throughput * 0.8) {
          const { finding } = await perceive({
            organizationId: orgId,
            eventType: "operational.throughput_drop",
            sourceModule: "operations",
            title: `Throughput drop: ${batch.name}`,
            description: `${batch.name} achieved ${Math.round((batch.throughput / batch.expected_throughput) * 100)}% of expected throughput`,
            entityId: batch.id,
            entityType: "batch",
            evidence: { throughput: batch.throughput, expected: batch.expected_throughput },
            signalStrength: batch.throughput < batch.expected_throughput * 0.5 ? 0.9 : 0.6,
          })
          findings.push(finding)
        }
      }

      return findings
    },
  },
]

export async function runMonitorCycle(organizationId: string): Promise<MonitorCheck[]> {
  const checks: MonitorCheck[] = []

  for (const monitor of MODULE_MONITORS) {
    const now = Date.now()
    if (monitor.lastCheck && now - monitor.lastCheck.getTime() < monitor.checkInterval) {
      continue
    }

    try {
      const findings = await monitor.check(organizationId)
      monitor.lastCheck = new Date()

      checks.push({
        module: monitor.module,
        lastChecked: new Date(),
        findings: findings.length,
        status: findings.length > 0 ? "warning" : "healthy",
      })
    } catch {
      checks.push({
        module: monitor.module,
        lastChecked: new Date(),
        findings: 0,
        status: "healthy",
      })
    }
  }

  return checks
}

export async function runAllMonitors(organizationId: string): Promise<MonitorCheck[]> {
  const checks: MonitorCheck[] = []
  for (const monitor of MODULE_MONITORS) {
    try {
      const findings = await monitor.check(organizationId)
      monitor.lastCheck = new Date()
      checks.push({
        module: monitor.module,
        lastChecked: new Date(),
        findings: findings.length,
        status: findings.length > 0 ? "warning" : "healthy",
      })
    } catch {
      checks.push({ module: monitor.module, lastChecked: new Date(), findings: 0, status: "healthy" })
    }
  }
  return checks
}

export function getMonitorStatus(checks: MonitorCheck[]): { total: number; warnings: number; critical: number; healthy: number } {
  return {
    total: checks.length,
    warnings: checks.filter((c) => c.status === "warning").length,
    critical: checks.filter((c) => c.status === "critical").length,
    healthy: checks.filter((c) => c.status === "healthy").length,
  }
}
