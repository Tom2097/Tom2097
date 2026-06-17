/**
 * Capacity enforcement + utilization reporting.
 *
 * Reads live counts from the database (service client, since these are
 * platform-wide aggregates that span tenants) and compares them against the
 * centralized limits in `capacity.ts`. Used by:
 *   - signup (tenant cap enforcement)
 *   - per-tenant guards (users / AI / workflows / storage)
 *   - the founder capacity dashboard
 */

import { createServiceClient } from "@/lib/supabase/service"
import {
  getCapacityLimits,
  CONCURRENCY_WINDOW_MINUTES,
  type CapacityLimits,
} from "@/lib/platform/capacity"

export interface CapacityMetric {
  key: string
  label: string
  used: number
  limit: number
  remaining: number
  /** 0–100, clamped. */
  utilization: number
  /** true when used >= limit. */
  atCapacity: boolean
  unit?: string
}

export interface PlatformCapacityReport {
  generatedAt: string
  limits: CapacityLimits
  platform: {
    tenants: CapacityMetric
    concurrentUsers: CapacityMetric
  }
  totals: {
    totalUsers: number
    totalActiveSubscriptions: number
  }
}

function buildMetric(
  key: string,
  label: string,
  used: number,
  limit: number,
  unit?: string,
): CapacityMetric {
  const remaining = Math.max(0, limit - used)
  const utilization = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return { key, label, used, limit, remaining, utilization, atCapacity: used >= limit, unit }
}

/* -------------------------------------------------------------------------- */
/* Platform-wide enforcement                                                  */
/* -------------------------------------------------------------------------- */

/** Current number of companies (tenants). */
export async function getTenantCount(): Promise<number> {
  const db = createServiceClient()
  const { count, error } = await db
    .from("organizations")
    .select("id", { count: "exact", head: true })
  if (error) {
    console.log("[v0] getTenantCount error:", error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Whether a new tenant can be created right now.
 * Fails OPEN only on the safe side: if the count query fails we BLOCK to avoid
 * silently exceeding the cap.
 */
export async function canCreateTenant(): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { maxTenants } = getCapacityLimits()
  const used = await getTenantCount()
  return { allowed: used < maxTenants, used, limit: maxTenants }
}

/** Approximate platform-wide concurrent users from recent analytics activity. */
export async function getConcurrentUserCount(): Promise<number> {
  const db = createServiceClient()
  const since = new Date(Date.now() - CONCURRENCY_WINDOW_MINUTES * 60 * 1000).toISOString()

  // Pull distinct user ids active within the window. analytics_events is the
  // highest-signal activity table that carries user_id.
  const { data, error } = await db
    .from("analytics_events")
    .select("user_id")
    .gte("occurred_at", since)
    .not("user_id", "is", null)
    .limit(5000)

  if (error || !data) {
    console.log("[v0] getConcurrentUserCount error:", error?.message)
    return 0
  }
  const unique = new Set(data.map((r) => r.user_id as string))
  return unique.size
}

/* -------------------------------------------------------------------------- */
/* Per-tenant enforcement                                                     */
/* -------------------------------------------------------------------------- */

/** Number of users (profiles) in a company. */
export async function getCompanyUserCount(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { count, error } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  if (error) {
    console.log("[v0] getCompanyUserCount error:", error.message)
    return 0
  }
  return count ?? 0
}

export async function canAddUserToCompany(
  organizationId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { maxUsersPerCompany } = getCapacityLimits()
  const used = await getCompanyUserCount(organizationId)
  return { allowed: used < maxUsersPerCompany, used, limit: maxUsersPerCompany }
}

/** Sum a usage metric for a tenant in the current calendar month. */
async function getMonthlyUsage(organizationId: string, metric: string): Promise<number> {
  const db = createServiceClient()
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { data, error } = await db
    .from("usage")
    .select("value")
    .eq("organization_id", organizationId)
    .eq("metric", metric)
    .gte("period_start", periodStart)
  if (error || !data) {
    console.log("[v0] getMonthlyUsage error:", error?.message)
    return 0
  }
  return data.reduce((sum, r) => sum + Number(r.value ?? 0), 0)
}

export async function canConsumeAiRequest(
  organizationId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { maxAiRequestsPerTenantMonthly } = getCapacityLimits()
  const used = await getMonthlyUsage(organizationId, "ai_requests")
  return { allowed: used < maxAiRequestsPerTenantMonthly, used, limit: maxAiRequestsPerTenantMonthly }
}

export async function canRunWorkflow(
  organizationId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { maxWorkflowExecutionsPerTenantMonthly } = getCapacityLimits()
  const used = await getMonthlyUsage(organizationId, "workflow_executions")
  return {
    allowed: used < maxWorkflowExecutionsPerTenantMonthly,
    used,
    limit: maxWorkflowExecutionsPerTenantMonthly,
  }
}

/* -------------------------------------------------------------------------- */
/* Founder capacity report                                                    */
/* -------------------------------------------------------------------------- */

export async function getPlatformCapacityReport(): Promise<PlatformCapacityReport> {
  const limits = getCapacityLimits()
  const db = createServiceClient()

  const [tenantCount, concurrent, usersRes, subsRes] = await Promise.all([
    getTenantCount(),
    getConcurrentUserCount(),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ])

  return {
    generatedAt: new Date().toISOString(),
    limits,
    platform: {
      tenants: buildMetric("tenants", "Companies", tenantCount, limits.maxTenants),
      concurrentUsers: buildMetric(
        "concurrent_users",
        "Concurrent Users",
        concurrent,
        limits.maxConcurrentUsers,
      ),
    },
    totals: {
      totalUsers: usersRes.count ?? 0,
      totalActiveSubscriptions: subsRes.count ?? 0,
    },
  }
}
