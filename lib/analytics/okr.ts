import { createServiceClient } from "@/lib/supabase/service"

export interface Objective {
  id: string
  organization_id: string
  name: string
  category: string
  owner: string | null
  start_date: string
  end_date: string
  status: "on_track" | "at_risk" | "behind" | "completed"
  progress: number
  created_at: string
}

export interface KeyResult {
  id: string
  objective_id: string
  name: string
  metric: string
  target: number
  current: number
  unit: string
  weight: number
}

export async function listObjectives(organizationId: string): Promise<Objective[]> {
  const db = createServiceClient()
  const { data } = await db.from("okr_objectives").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
  return (data ?? []) as Objective[]
}

export async function listKeyResults(objectiveId: string): Promise<KeyResult[]> {
  const db = createServiceClient()
  const { data } = await db.from("okr_key_results").select("*").eq("objective_id", objectiveId)
  return (data ?? []) as KeyResult[]
}

export async function updateKeyResultValue(krId: string, currentValue: number): Promise<KeyResult | null> {
  const db = createServiceClient()
  const { data: kr } = await db.from("okr_key_results").select("*").eq("id", krId).single()
  if (!kr) return null
  const k = kr as KeyResult
  const progress = k.target > 0 ? Math.min(100, Math.round((currentValue / k.target) * 100)) : 0

  const { data, error } = await db.from("okr_key_results").update({ current: currentValue }).eq("id", krId).select("*").single()
  if (error) return null

  // Recalculate objective progress
  const { data: krs } = await db.from("okr_key_results").select("*").eq("objective_id", k.objective_id)
  const allKrs = (krs ?? []) as KeyResult[]
  const totalWeight = allKrs.reduce((s, r) => s + r.weight, 0)
  const weightedProgress = totalWeight > 0
    ? Math.round(allKrs.reduce((s, r) => s + (r.target > 0 ? Math.min(100, (r.current / r.target) * 100) * r.weight : 0), 0) / totalWeight)
    : 0

  const status = weightedProgress >= 100 ? "completed" : weightedProgress >= 70 ? "on_track" : weightedProgress >= 40 ? "at_risk" : "behind"
  await db.from("okr_objectives").update({ progress: weightedProgress, status }).eq("id", k.objective_id)

  return data as KeyResult
}

export async function computePacing(organizationId: string, objectiveId: string): Promise<{
  expected: number; actual: number; variance: number; ahead: boolean
}> {
  const db = createServiceClient()
  const { data: obj } = await db.from("okr_objectives").select("*").eq("id", objectiveId).eq("organization_id", organizationId).single()
  if (!obj) return { expected: 0, actual: 0, variance: 0, ahead: false }
  const o = obj as Objective
  const totalDays = (new Date(o.end_date).getTime() - new Date(o.start_date).getTime()) / 86400000
  const elapsed = (Date.now() - new Date(o.start_date).getTime()) / 86400000
  const expected = totalDays > 0 ? Math.round((elapsed / totalDays) * 100) : 0
  const variance = o.progress - expected
  return { expected, actual: o.progress, variance, ahead: variance > 0 }
}
