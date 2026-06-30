import { createServiceClient } from "@/lib/supabase/service"

export interface BrainHealth {
  overall: "healthy" | "degraded" | "critical"
  modules: ModuleHealth[]
  uptimeHours: number
  tasksLast24h: number
  taskFailureRate: number
  totalFindings: number
  criticalFindings: number
  lastLearningCycle: string | null
  lastBriefing: string | null
}

export interface ModuleHealth {
  name: string
  status: "healthy" | "warning" | "critical" | "inactive"
  findings: number
  totalRisk: number
  lastScan: string | null
}

export async function getBrainHealth(organizationId: string): Promise<BrainHealth> {
  const db = createServiceClient()

  const { data: findings } = await db
    .from("intelligence_findings")
    .select("id, source_module, monetary_risk, detected_at")
    .eq("organization_id", organizationId)
    .eq("status", "active")

  const activeFindings = (findings || []) as Array<{ id: string; source_module: string; monetary_risk: number; detected_at: string }>

  const criticalCount = activeFindings.filter((f) => f.monetary_risk > 50000).length

  const moduleMap = new Map<string, ModuleHealth>()
  const moduleDefaults = ["compliance", "resources", "crm", "operations", "performance"]

  for (const mod of moduleDefaults) {
    moduleMap.set(mod, {
      name: mod,
      status: "healthy",
      findings: 0,
      totalRisk: 0,
      lastScan: null,
    })
  }

  for (const f of activeFindings) {
    const existing = moduleMap.get(f.source_module)
    if (existing) {
      existing.findings++
      existing.totalRisk += f.monetary_risk ?? 0
      if (f.monetary_risk > 50000) existing.status = "critical"
      else if (f.monetary_risk > 10000 && existing.status === "healthy") existing.status = "warning"
      if (!existing.lastScan || f.detected_at > existing.lastScan) {
        existing.lastScan = f.detected_at
      }
    }
  }

  const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
  const { data: recentTasks } = await db
    .from("intelligence_scheduled_tasks")
    .select("status")
    .eq("organization_id", organizationId)
    .gte("started_at", oneDayAgo)

  const tasks = (recentTasks || []) as Array<{ status: string }>
  const taskCount = tasks.length
  const failedCount = tasks.filter((t) => t.status === "failed").length
  const failureRate = taskCount > 0 ? failedCount / taskCount : 0

  const { data: lastLearning } = await db
    .from("intelligence_scheduled_tasks")
    .select("completed_at")
    .eq("organization_id", organizationId)
    .eq("task", "run_learning")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: lastBriefing } = await db
    .from("intelligence_briefings")
    .select("generated_at")
    .eq("organization_id", organizationId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const moduleHealths = Array.from(moduleMap.values())
  const worstStatus = moduleHealths.some((m) => m.status === "critical") ? "critical"
    : moduleHealths.some((m) => m.status === "warning") ? "degraded"
    : "healthy"

  return {
    overall: worstStatus,
    modules: moduleHealths,
    uptimeHours: 24,
    tasksLast24h: taskCount,
    taskFailureRate: Math.round(failureRate * 100),
    totalFindings: activeFindings.length,
    criticalFindings: criticalCount,
    lastLearningCycle: (lastLearning as { completed_at?: string })?.completed_at ?? null,
    lastBriefing: (lastBriefing as { generated_at?: string })?.generated_at ?? null,
  }
}

export async function getEngineStatus(): Promise<{
  version: string
  uptime: number
  memoryMb: number
}> {
  return {
    version: "2.0",
    uptime: process.uptime(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  }
}
