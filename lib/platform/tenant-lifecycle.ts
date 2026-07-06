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
  return data as Record<string, unknown> | null
}
