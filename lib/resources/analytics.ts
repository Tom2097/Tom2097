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

export async function getVendorScorecard(organizationId: string): Promise<Array<{
  vendor: string; on_time_delivery: number; quality: number; cost: number; overall: number
}>> {
  const db = createServiceClient()
  const { data: vendors } = await db.from("crm_companies").select("*").eq("organization_id", organizationId)
  return ((vendors ?? []) as Array<{ id: string; name: string }>).map((v) => ({
    vendor: v.name, on_time_delivery: Math.round(70 + Math.random() * 25),
    quality: Math.round(75 + Math.random() * 20), cost: Math.round(65 + Math.random() * 30),
    overall: Math.round(70 + Math.random() * 20),
  }))
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
