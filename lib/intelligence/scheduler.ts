import { createServiceClient } from "@/lib/supabase/service"
import { runAllMonitors } from "./monitor"
import { generateBriefing } from "./briefing"
import { autoAssignFindings } from "./agents"
import { getActiveFindings } from "./engine"
import { broadcast } from "@/lib/notifications/engine"
import type { IntelligenceFinding } from "./types"

const SCHEDULES_TABLE = "intelligence_schedules"
const TASKS_TABLE = "intelligence_scheduled_tasks"

export interface ScheduleConfig {
  id: string
  organizationId: string
  task: "monitor_scan" | "generate_briefing" | "auto_assign" | "sync_graph" | "push_alerts" | "run_learning"
  intervalMinutes: number
  lastRunAt: Date | null
  enabled: boolean
}

export interface ScheduledTaskResult {
  taskId: string
  task: string
  status: "completed" | "failed"
  startedAt: Date
  completedAt: Date
  details: Record<string, unknown>
}

export async function ensureSchedules(organizationId: string): Promise<void> {
  const db = createServiceClient()
  const defaults: Array<Omit<ScheduleConfig, "id" | "lastRunAt">> = [
    { organizationId, task: "monitor_scan", intervalMinutes: 60, enabled: true },
    { organizationId, task: "generate_briefing", intervalMinutes: 1440, enabled: true },
    { organizationId, task: "auto_assign", intervalMinutes: 30, enabled: true },
    { organizationId, task: "sync_graph", intervalMinutes: 120, enabled: true },
    { organizationId, task: "push_alerts", intervalMinutes: 15, enabled: true },
    { organizationId, task: "run_learning", intervalMinutes: 360, enabled: true },
  ]

  for (const sched of defaults) {
    const { data: existing } = await db
      .from(SCHEDULES_TABLE)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("task", sched.task)
      .maybeSingle()

    if (!existing) {
      await db.from(SCHEDULES_TABLE).insert({
        organization_id: organizationId,
        task: sched.task,
        interval_minutes: sched.intervalMinutes,
        enabled: sched.enabled,
      })
    }
  }
}

export async function getDueTasks(): Promise<Array<{ id: string; organizationId: string; task: string }>> {
  const db = createServiceClient()
  const now = new Date().toISOString()
  const { data } = await db
    .from(SCHEDULES_TABLE)
    .select("id, organization_id, task")
    .eq("enabled", true)
    .or(
      `last_run_at.is.null,last_run_at.lte.${now}::timestamptz - (interval_minutes || ' minutes')::interval`,
    )

  return ((data as Array<Record<string, unknown>>) || []).map((r) => ({
    id: r.id as string,
    organizationId: r.organization_id as string,
    task: r.task as string,
  }))
}

export async function executeTask(
  scheduleId: string,
  organizationId: string,
  task: string,
): Promise<ScheduledTaskResult> {
  const db = createServiceClient()
  const startedAt = new Date()
  const taskId = crypto.randomUUID()

  await db.from(TASKS_TABLE).insert({
    id: taskId,
    organization_id: organizationId,
    schedule_id: scheduleId,
    task,
    status: "running",
    started_at: startedAt.toISOString(),
  })

  try {
    let details: Record<string, unknown> = {}

    switch (task) {
      case "monitor_scan": {
        const checks = await runAllMonitors(organizationId)
        details = { checks, checkCount: checks.length, warnings: checks.filter((c) => c.status === "warning").length }
        break
      }
      case "generate_briefing": {
        const briefing = await generateBriefing(organizationId)
        const findings = await getActiveFindings(organizationId, 5)
        const critical = findings.filter((f) => f.monetaryRisk && f.monetaryRisk > 50000)

        if (critical.length > 0) {
          await pushAlert(organizationId, critical)
        }
        details = { briefingId: briefing.id, criticalCount: critical.length }
        break
      }
      case "auto_assign": {
        const actions = await autoAssignFindings(organizationId)
        details = { assigned: actions.length }
        break
      }
      case "sync_graph": {
        const { syncAllModules } = await import("./sync")
        const count = await syncAllModules(organizationId)
        details = { syncedEntities: count }
        break
      }
      case "push_alerts": {
        const findings = await getActiveFindings(organizationId, 5)
        const critical = findings.filter((f) => f.monetaryRisk && f.monetaryRisk > 25000)
        if (critical.length > 0) {
          await pushAlert(organizationId, critical)
        }
        details = { criticalAlerts: critical.length }
        break
      }
      case "run_learning": {
        const { runLearningCycle } = await import("./learning/pipeline")
        const result = await runLearningCycle(organizationId)
        details = { ...result }
        break
      }
    }

    const completedAt = new Date()
    await db.from(TASKS_TABLE).update({
      status: "completed",
      completed_at: completedAt.toISOString(),
      details,
    }).eq("id", taskId)

    await db.from(SCHEDULES_TABLE).update({
      last_run_at: completedAt.toISOString(),
    }).eq("id", scheduleId)

    return { taskId, task, status: "completed", startedAt, completedAt, details }
  } catch (err) {
    const completedAt = new Date()
    const errorMsg = String(err)

    await db.from(TASKS_TABLE).update({
      status: "failed",
      completed_at: completedAt.toISOString(),
      details: { error: errorMsg },
    }).eq("id", taskId)

    const { data: failedCount } = await db
      .from(TASKS_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("schedule_id", scheduleId)
      .eq("status", "failed")
      .gte("started_at", new Date(Date.now() - 86400000).toISOString())

    const retryCount = (failedCount ?? 0) as number
    if (retryCount < 3) {
      const backoffMinutes = Math.pow(2, retryCount) * 5
      await db.from(SCHEDULES_TABLE).update({
        last_run_at: new Date(Date.now() + backoffMinutes * 60000).toISOString(),
      }).eq("id", scheduleId)
    }

    return { taskId, task, status: "failed", startedAt, completedAt, details: { error: errorMsg } }
  }
}

export async function processAllDueTasks(): Promise<ScheduledTaskResult[]> {
  const due = await getDueTasks()
  const results: ScheduledTaskResult[] = []
  for (const t of due) {
    const result = await executeTask(t.id, t.organizationId, t.task)
    results.push(result)
  }
  return results
}

async function pushAlert(organizationId: string, findings: IntelligenceFinding[]): Promise<void> {
  const db = createServiceClient()
  const { data: profiles } = await db
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(10)

  if (!profiles || profiles.length === 0) return

  const maxRiskFinding = findings.sort((a, b) => (b.monetaryRisk ?? 0) - (a.monetaryRisk ?? 0))[0]

  await broadcast(
    organizationId,
    {
      type: "warning",
      category: "intelligence_alert",
      priority: findings.some((f) => (f.monetaryRisk ?? 0) > 50000) ? "urgent" : "high",
      title: `${findings.length} critical ${findings.length === 1 ? "alert" : "alerts"} from AI Intelligence`,
      body: `Top: ${maxRiskFinding.title} ($${maxRiskFinding.monetaryRisk?.toLocaleString() ?? "unknown"} risk)`,
      action_url: "/intelligence",
      source: "system",
    },
    profiles.map((p: { id: string }) => p.id),
  )
}

export async function getTaskHistory(
  organizationId: string,
  limit: number = 20,
): Promise<ScheduledTaskResult[]> {
  const db = createServiceClient()
  const { data } = await db
    .from(TASKS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(limit)

  return ((data as Array<Record<string, unknown>>) || []).map((r) => ({
    taskId: r.id as string,
    task: r.task as string,
    status: r.status as "completed" | "failed",
    startedAt: new Date(r.started_at as string),
    completedAt: new Date(r.completed_at as string),
    details: r.details as Record<string, unknown>,
  }))
}
