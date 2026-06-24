import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export type CapaStatus = "open" | "investigation" | "action" | "verification" | "closed"
export type CapaSeverity = "minor" | "major" | "critical"

export interface CapaRecord {
  id: string
  organization_id: string
  title: string
  description: string
  source: string
  severity: CapaSeverity
  status: CapaStatus
  assigned_to: string | null
  sla_deadline: string | null
  investigation_notes: string | null
  action_taken: string | null
  verification_notes: string | null
  closed_at: string | null
  closed_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

const TRANSITIONS: Record<CapaStatus, CapaStatus[]> = {
  open: ["investigation"],
  investigation: ["action", "open"],
  action: ["verification", "investigation"],
  verification: ["closed", "action"],
  closed: [],
}

export function canTransition(from: CapaStatus, to: CapaStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export async function createCapa(
  organizationId: string,
  input: { title: string; description: string; source: string; severity: CapaSeverity; assigned_to?: string; sla_days?: number },
  userId: string,
): Promise<CapaRecord | null> {
  const db = createServiceClient()
  const slaDeadline = input.sla_days ? new Date(Date.now() + input.sla_days * 86400000).toISOString() : null
  const { data, error } = await db
    .from("capa_records")
    .insert({
      organization_id: organizationId, title: input.title, description: input.description,
      source: input.source, severity: input.severity, status: "open",
      assigned_to: input.assigned_to ?? null, sla_deadline: slaDeadline, created_by: userId,
    })
    .select("*")
    .single()
  if (error) return null
  const capa = data as CapaRecord
  await publish({ type: "compliance.capa_created", organization_id: organizationId, data: { capa_id: capa.id, severity: capa.severity } })
  return capa
}

export async function transitionCapa(
  organizationId: string, capaId: string, toStatus: CapaStatus, notes: string | null, userId: string,
): Promise<CapaRecord | null> {
  const db = createServiceClient()
  const { data: capa } = await db.from("capa_records").select("*").eq("id", capaId).eq("organization_id", organizationId).single()
  if (!capa || !canTransition(capa.status as CapaStatus, toStatus)) return null

  const patch: Record<string, unknown> = { status: toStatus, updated_at: new Date().toISOString() }
  if (toStatus === "investigation") patch.investigation_notes = notes
  if (toStatus === "action") patch.action_taken = notes
  if (toStatus === "verification") patch.verification_notes = notes
  if (toStatus === "closed") { patch.closed_at = new Date().toISOString(); patch.closed_by = userId }

  const { data, error } = await db.from("capa_records").update(patch).eq("id", capaId).select("*").single()
  if (error) return null
  if (toStatus === "closed") {
    await publish({ type: "compliance.capa_closed", organization_id: organizationId, data: { capa_id: capaId } })
  }
  return data as CapaRecord
}

export async function listCapa(organizationId: string, status?: CapaStatus): Promise<CapaRecord[]> {
  const db = createServiceClient()
  let q = db.from("capa_records").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
  if (status) q = q.eq("status", status)
  const { data } = await q
  return (data ?? []) as CapaRecord[]
}
