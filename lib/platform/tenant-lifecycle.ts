"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { createAuditEntry } from "@/lib/audit/append-only"

export interface TenantInfo {
  id: string
  name: string
  plan: string
  status: "active" | "suspended" | "trialing" | "deprovisioned"
  userCount: number
  createdAt: string
  email?: string
}

export async function listTenants(): Promise<TenantInfo[]> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from("organizations")
    .select(`
      id, name, created_at, status,
      subscriptions (plan_id, status),
      profiles!inner (id)
    `)
    .order("created_at", { ascending: false })

  if (!data) return []
  
  return data.map((org: Record<string, unknown>) => {
    const subs = (org.subscriptions as Record<string, unknown>[]) || []
    const profiles = (org.profiles as Record<string, unknown>[]) || []
    return {
      id: org.id as string,
      name: org.name as string,
      plan: subs[0]?.plan_id as string || "free",
      status: (subs[0]?.status as string) === "active" ? "active" : (org.status as string) || "active",
      userCount: profiles.length,
      createdAt: org.created_at as string,
    } as TenantInfo
  })
}

export async function suspendTenant(tenantId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()
  const { data: { user } } = await (await (await import("@/lib/supabase/server")).createClient()).auth.getUser()
  
  await supabase
    .from("organizations")
    .update({ status: "suspended", suspended_at: new Date().toISOString(), suspension_reason: reason })
    .eq("id", tenantId)
  
  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("organization_id", tenantId)
  
  if (user) {
    const auditEntry = createAuditEntry("organizations", tenantId, "UPDATE", null, { status: "suspended", reason }, user.id, tenantId)
    await supabase.from("audit_log_entries").insert(auditEntry)
  }
  
  return { success: true }
}

export async function activateTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()
  const { data: { user } } = await (await (await import("@/lib/supabase/server")).createClient()).auth.getUser()
  
  await supabase
    .from("organizations")
    .update({ status: "active", suspended_at: null, suspension_reason: null })
    .eq("id", tenantId)
  
  await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("organization_id", tenantId)
  
  if (user) {
    const auditEntry = createAuditEntry("organizations", tenantId, "UPDATE", null, { status: "active" }, user.id, tenantId)
    await supabase.from("audit_log_entries").insert(auditEntry)
  }
  
  return { success: true }
}

export async function deprovisionTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()
  const { data: { user } } = await (await (await import("@/lib/supabase/server")).createClient()).auth.getUser()
  
  await supabase.from("organizations").update({ status: "deprovisioned", deprovisioned_at: new Date().toISOString() }).eq("id", tenantId)
  await supabase.from("subscriptions").update({ status: "cancelled" }).eq("organization_id", tenantId)
  
  if (user) {
    const auditEntry = createAuditEntry("organizations", tenantId, "UPDATE", null, { status: "deprovisioned" }, user.id, tenantId)
    await supabase.from("audit_log_entries").insert(auditEntry)
  }
  
  return { success: true }
}

function describeAuditEntry(entry: { action: string; table_name: string; new_data: Record<string, unknown> | null }): string {
  const table = entry.table_name.replace(/_/g, " ")
  if (entry.action === "INSERT") return `Created ${table}`
  if (entry.action === "DELETE") return `Deleted ${table}`
  const status = entry.new_data?.status
  if (status) return `${table} updated: status → ${status}`
  return `${table} updated`
}

async function getTenantActivity(supabase: ReturnType<typeof createServiceClient>, tenantId: string, limit = 20) {
  const { data: entries } = await supabase
    .from("audit_log_entries")
    .select("action, table_name, new_data, changed_by, changed_at")
    .eq("organization_id", tenantId)
    .order("changed_at", { ascending: false })
    .limit(limit)

  const rows = entries ?? []
  const actorIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))]
  const { data: actors } = actorIds.length > 0
    ? await supabase.from("profiles").select("id, email, full_name").in("id", actorIds)
    : { data: [] as { id: string; email: string; full_name: string | null }[] }
  const actorById = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.email]))

  return rows.map((r) => ({
    action: describeAuditEntry(r),
    date: r.changed_at,
    user: (r.changed_by && actorById.get(r.changed_by)) || "System",
  }))
}

export async function getTenantDetail(tenantId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from("organizations")
    .select(`
      *,
      subscriptions (*),
      profiles (id, email, full_name, role, created_at)
    `)
    .eq("id", tenantId)
    .single()
  if (!data) return null

  const activity = await getTenantActivity(supabase, tenantId)
  return { ...data, activity } as Record<string, unknown>
}
