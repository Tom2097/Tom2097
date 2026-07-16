import { createServiceClient } from "@/lib/supabase/service"

export async function getCapacityUtilization(organizationId: string): Promise<{
  total_capacity: number; allocated: number; available: number; utilization_pct: number
}> {
  const db = createServiceClient()
  const { data: resources } = await db.from("assets").select("status").eq("organization_id", organizationId)
  const items = (resources ?? []) as Array<{ status: string }>
  const total = items.length
  const allocated = items.filter((a) => a.status === "active").length
  return { total_capacity: total, allocated, available: total - allocated, utilization_pct: total > 0 ? Math.round((allocated / total) * 100) : 0 }
}

/**
 * No delivery/quality/cost tracking exists anywhere in this schema, so a
 * 0-100 "performance score" can't be computed honestly. Reports real
 * relationship signals instead -- deal count/value and recency of contact --
 * derived from the real crm_deals/crm_activities tables.
 */
export async function getVendorScorecard(organizationId: string): Promise<Array<{
  vendor: string; dealCount: number; totalValue: number; lastActivityDaysAgo: number | null
}>> {
  const db = createServiceClient()
  const { data: vendors } = await db.from("crm_companies").select("id, name").eq("organization_id", organizationId)
  const companies = (vendors ?? []) as Array<{ id: string; name: string }>
  if (companies.length === 0) return []

  const companyIds = companies.map((c) => c.id)
  const [{ data: deals }, { data: activities }] = await Promise.all([
    db.from("crm_deals").select("company_id, value").in("company_id", companyIds),
    db.from("crm_activities").select("entity_id, created_at").eq("entity_type", "company").in("entity_id", companyIds),
  ])

  const dealsByCompany = new Map<string, { count: number; total: number }>()
  for (const d of deals ?? []) {
    const entry = dealsByCompany.get(d.company_id) ?? { count: 0, total: 0 }
    entry.count += 1
    entry.total += Number(d.value ?? 0)
    dealsByCompany.set(d.company_id, entry)
  }

  const lastActivityByCompany = new Map<string, string>()
  for (const a of activities ?? []) {
    const existing = lastActivityByCompany.get(a.entity_id)
    if (!existing || a.created_at > existing) lastActivityByCompany.set(a.entity_id, a.created_at)
  }

  return companies.map((v) => {
    const deal = dealsByCompany.get(v.id) ?? { count: 0, total: 0 }
    const lastActivity = lastActivityByCompany.get(v.id)
    return {
      vendor: v.name,
      dealCount: deal.count,
      totalValue: Math.round(deal.total),
      lastActivityDaysAgo: lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000) : null,
    }
  })
}

export async function getSkillGaps(organizationId: string): Promise<Array<{ skill: string; required: number; available: number; gap: number }>> {
  const db = createServiceClient()
  const { data: requirements } = await db.from("skill_requirements").select("*").eq("organization_id", organizationId)
  const { data: profiles } = await db.from("skill_profiles").select("*").eq("organization_id", organizationId)
  const reqs = (requirements ?? []) as Array<{ skill: string; min_level: number }>
  const profs = (profiles ?? []) as Array<{ skill: string; level: number }>
  return reqs.map((r) => {
    const available = profs.filter((p) => p.skill === r.skill && p.level >= r.min_level).length
    return { skill: r.skill, required: 1, available, gap: Math.max(0, 1 - available) }
  })
}
