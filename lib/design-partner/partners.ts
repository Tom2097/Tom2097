import { createServiceClient } from "@/lib/supabase/service"

export type DesignPartnerStage = "awareness" | "evaluation" | "pilot" | "launch" | "advocate"

export interface DesignPartner {
  id: string
  name: string
  company: string
  email: string
  stage: DesignPartnerStage
  vertical: string
  feedbackScore: number
  lastTouchpoint: string
  notes: string
}

interface DesignPartnerRow {
  id: string
  name: string
  company: string
  email: string
  stage: DesignPartnerStage
  vertical: string | null
  feedback_score: number
  last_touchpoint: string
  notes: string | null
}

function toDesignPartner(row: DesignPartnerRow): DesignPartner {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    stage: row.stage,
    vertical: row.vertical ?? "",
    feedbackScore: row.feedback_score,
    lastTouchpoint: row.last_touchpoint,
    notes: row.notes ?? "",
  }
}

export async function listPartners(): Promise<DesignPartner[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("design_partners")
    .select("*")
    .order("last_touchpoint", { ascending: false })
  return ((data ?? []) as DesignPartnerRow[]).map(toDesignPartner)
}

export async function getPartner(id: string): Promise<DesignPartner | null> {
  const db = createServiceClient()
  const { data } = await db.from("design_partners").select("*").eq("id", id).maybeSingle()
  return data ? toDesignPartner(data as DesignPartnerRow) : null
}

export async function updatePartnerStage(id: string, stage: DesignPartnerStage): Promise<DesignPartner | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("design_partners")
    .update({ stage, last_touchpoint: new Date().toISOString().split("T")[0] })
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error || !data) return null
  return toDesignPartner(data as DesignPartnerRow)
}

export async function updatePartnerNotes(id: string, notes: string): Promise<DesignPartner | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("design_partners")
    .update({ notes, last_touchpoint: new Date().toISOString().split("T")[0] })
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error || !data) return null
  return toDesignPartner(data as DesignPartnerRow)
}

export async function createPartner(input: Omit<DesignPartner, "id">): Promise<DesignPartner | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("design_partners")
    .insert({
      name: input.name,
      company: input.company,
      email: input.email,
      stage: input.stage,
      vertical: input.vertical,
      feedback_score: input.feedbackScore,
      last_touchpoint: input.lastTouchpoint || new Date().toISOString().split("T")[0],
      notes: input.notes,
    })
    .select("*")
    .single()
  if (error || !data) return null
  return toDesignPartner(data as DesignPartnerRow)
}
