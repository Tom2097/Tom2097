import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

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

export async function createObjective(
  organizationId: string,
  input: { name: string; category?: string; owner?: string; start_date: string; end_date: string },
  userId: string,
): Promise<Objective | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("okr_objectives")
    .insert({
      organization_id: organizationId,
      name: input.name,
      category: input.category ?? null,
      owner: input.owner ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      status: "on_track",
      progress: 0,
      created_by: userId,
    })
    .select("*")
    .single()
  if (error) return null
  return data as Objective
}

export async function listObjectives(organizationId: string): Promise<Objective[]> {
  const db = createServiceClient()
  const { data } = await db.from("okr_objectives").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
  return (data ?? []) as Objective[]
}

/** Org-scoped single objective lookup -- used to authorize key-result reads/writes below. */
export async function getObjective(organizationId: string, objectiveId: string): Promise<Objective | null> {
  const db = createServiceClient()
  const { data } = await db
    .from("okr_objectives")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", objectiveId)
    .maybeSingle()
  return (data as Objective) ?? null
}

export async function listKeyResults(objectiveId: string): Promise<KeyResult[]> {
  const db = createServiceClient()
  const { data } = await db.from("okr_key_results").select("*").eq("objective_id", objectiveId)
  return (data ?? []) as KeyResult[]
}

export async function createKeyResult(
  objectiveId: string,
  input: { name: string; metric?: string; target: number; current?: number; unit?: string; weight?: number },
): Promise<KeyResult | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("okr_key_results")
    .insert({
      objective_id: objectiveId,
      name: input.name,
      metric: input.metric ?? null,
      target: input.target,
      current: input.current ?? 0,
      unit: input.unit ?? null,
      weight: input.weight ?? 1,
    })
    .select("*")
    .single()
  if (error) return null
  return data as KeyResult
}

export async function updateKeyResultValue(krId: string, currentValue: number): Promise<KeyResult | null> {
  const db = createServiceClient()
  const { data: kr } = await db.from("okr_key_results").select("*").eq("id", krId).single()
  if (!kr) return null
  const k = kr as KeyResult

  const { data, error } = await db.from("okr_key_results").update({ current: currentValue }).eq("id", krId).select("*").single()
  if (error) return null

  // objective_id is a UUID scoped to a single org's okr_objectives row, so
  // this select is safe without a redundant organization_id filter here --
  // it exists purely to read the PRIOR status/title/org before overwriting
  // them below, for the transition check just after.
  const { data: priorObjective } = await db
    .from("okr_objectives")
    .select("status,title,organization_id")
    .eq("id", k.objective_id)
    .maybeSingle()

  // Recalculate objective progress
  const { data: krs } = await db.from("okr_key_results").select("*").eq("objective_id", k.objective_id)
  const allKrs = (krs ?? []) as KeyResult[]
  const totalWeight = allKrs.reduce((s, r) => s + r.weight, 0)
  const weightedProgress = totalWeight > 0
    ? Math.round(allKrs.reduce((s, r) => s + (r.target > 0 ? Math.min(100, (r.current / r.target) * 100) * r.weight : 0), 0) / totalWeight)
    : 0

  const status = weightedProgress >= 100 ? "completed" : weightedProgress >= 70 ? "on_track" : weightedProgress >= 40 ? "at_risk" : "behind"
  await db.from("okr_objectives").update({ progress: weightedProgress, status }).eq("id", k.objective_id)

  // Publish only on a genuine transition INTO at_risk (not on every
  // key-result update that leaves an already-at_risk objective at_risk) --
  // this is the real, persisted status write every key-result update goes
  // through (there is no separate scheduled pacing check), so comparing
  // against the status this same row held a moment ago is what avoids
  // re-publishing the same stale objective on every update. pacing_pct is
  // the real weighted progress percentage that just crossed into the
  // at_risk band (40-69%) -- the same number that drives `status` above --
  // rather than the separate, unpersisted expected-vs-actual pacing
  // computePacing() renders for the UI, which has no prior stored value to
  // diff against here.
  if (priorObjective && priorObjective.status !== "at_risk" && status === "at_risk") {
    await publish({
      type: "objective.at_risk",
      organization_id: priorObjective.organization_id as string,
      data: { objective_id: k.objective_id, title: (priorObjective.title as string) ?? "", pacing_pct: weightedProgress },
    })
  }

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
