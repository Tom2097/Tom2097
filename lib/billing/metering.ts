import { createServiceClient } from "@/lib/supabase/service"

export interface UsageRecord {
  id: string
  organization_id: string
  metric: UsageMetric
  amount: number
  recorded_at: string
}

export type UsageMetric =
  | "ai_actions"
  | "api_calls"
  | "data_points"
  | "storage_bytes"
  | "seats"
  | "documents_processed"
  | "whatsapp_messages"

export interface UsageQuota {
  metric: UsageMetric
  limit: number
  used: number
  remaining: number
  unit: string
}

export interface TierLimits {
  ai_actions: number
  api_calls: number
  data_points: number
  storage_bytes: number
  seats: number
  documents_processed: number
  whatsapp_messages: number
}

const TIER_LIMITS: Record<string, TierLimits> = {
  free: { ai_actions: 100, api_calls: 1000, data_points: 50000, storage_bytes: 104857600, seats: 2, documents_processed: 500, whatsapp_messages: 100 },
  starter: { ai_actions: 1000, api_calls: 5000, data_points: 100000, storage_bytes: 524288000, seats: 5, documents_processed: 2000, whatsapp_messages: 500 },
  professional: { ai_actions: 10000, api_calls: 50000, data_points: 1000000, storage_bytes: 2147483648, seats: 25, documents_processed: 10000, whatsapp_messages: 5000 },
  enterprise: { ai_actions: 100000, api_calls: 500000, data_points: -1, storage_bytes: -1, seats: -1, documents_processed: -1, whatsapp_messages: -1 },
}

const METRIC_UNITS: Record<UsageMetric, string> = {
  ai_actions: "actions",
  api_calls: "calls",
  data_points: "points",
  storage_bytes: "MB",
  seats: "users",
  documents_processed: "docs",
  whatsapp_messages: "messages",
}

export async function recordUsage(
  organizationId: string,
  metric: UsageMetric,
  amount: number = 1,
): Promise<void> {
  const db = createServiceClient()
  await db.from("usage_records").insert({
    organization_id: organizationId,
    metric,
    amount,
    recorded_at: new Date().toISOString(),
  })
}

export async function getUsageForPeriod(
  organizationId: string,
  metric: UsageMetric,
  since: Date = new Date(Date.now() - 30 * 86400000),
): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("usage_records")
    .select("amount")
    .eq("organization_id", organizationId)
    .eq("metric", metric)
    .gte("recorded_at", since.toISOString())

  return ((data ?? []) as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0)
}

export async function getQuotas(
  organizationId: string,
): Promise<UsageQuota[]> {
  const db = createServiceClient()

  const { data: sub } = await db
    .from("subscriptions")
    .select("plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const planId = ((sub as any)?.plan_id as string) || "free"
  const limits = TIER_LIMITS[planId] || TIER_LIMITS.free
  const since = new Date(Date.now() - 30 * 86400000)

  const metrics: UsageMetric[] = ["ai_actions", "api_calls", "data_points", "storage_bytes", "seats", "documents_processed", "whatsapp_messages"]
  const results: UsageQuota[] = []

  for (const metric of metrics) {
    const used = await getUsageForPeriod(organizationId, metric, since)
    const limit = limits[metric]
    results.push({
      metric,
      limit,
      used,
      remaining: limit === -1 ? -1 : Math.max(0, limit - used),
      unit: METRIC_UNITS[metric],
    })
  }

  return results
}

export async function checkQuota(
  organizationId: string,
  metric: UsageMetric,
): Promise<{ allowed: boolean; remaining: number }> {
  const quotas = await getQuotas(organizationId)
  const quota = quotas.find((q) => q.metric === metric)
  if (!quota) return { allowed: true, remaining: -1 }
  if (quota.limit === -1) return { allowed: true, remaining: -1 }
  return { allowed: quota.remaining > 0, remaining: quota.remaining }
}

export async function getUsageSummary(
  organizationId: string,
): Promise<{ quotas: UsageQuota[]; totalAiActions: number; percentUsed: number }> {
  const quotas = await getQuotas(organizationId)
  const aiQuota = quotas.find((q) => q.metric === "ai_actions")
  const totalAiActions = aiQuota?.used || 0
  const percentUsed = aiQuota?.limit === -1 ? 0 : aiQuota ? Math.round((aiQuota.used / aiQuota.limit) * 100) : 0
  return { quotas, totalAiActions, percentUsed }
}

export async function getDailyUsage(
  organizationId: string,
  metric: UsageMetric,
  days: number = 30,
): Promise<Array<{ date: string; amount: number }>> {
  const db = createServiceClient()
  const since = new Date(Date.now() - days * 86400000)

  const { data } = await db
    .from("usage_records")
    .select("amount, recorded_at")
    .eq("organization_id", organizationId)
    .eq("metric", metric)
    .gte("recorded_at", since.toISOString())
    .order("recorded_at", { ascending: true })

  const byDay = new Map<string, number>()
  for (const r of (data ?? []) as Array<{ amount: number; recorded_at: string }>) {
    const day = r.recorded_at.split("T")[0]
    byDay.set(day, (byDay.get(day) || 0) + r.amount)
  }

  const result: Array<{ date: string; amount: number }> = []
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000)
    const key = d.toISOString().split("T")[0]
    result.push({ date: key, amount: byDay.get(key) || 0 })
  }

  return result
}
