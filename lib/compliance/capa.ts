import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"
import { startWorkflowRun } from "@/lib/hitl/workflow-runs"
import { raiseHAR } from "@/lib/hitl/har"
import { registerContinuation } from "@/lib/hitl/continuations"

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
  // capa_records has no framework column (see supabase/migrations/20260715000000_operations_action_layer.sql
  // and 20260720000000_critical_backfill.sql) -- this insert path never knows a framework, so it's always
  // null here. Kept as a separate event (vs. reusing compliance.capa_created above) because it's the
  // event_job_subscriptions-mapped type that drives the compliance.notify_capa background job (lib/compliance/jobs.ts).
  await publish({ type: "capa.created", organization_id: organizationId, data: { capa_id: capa.id, severity: capa.severity, framework: null } })
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

  const { data, error } = await db
    .from("capa_records")
    .update(patch)
    .eq("id", capaId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()
  if (error) return null
  if (toStatus === "closed") {
    await publish({ type: "compliance.capa_closed", organization_id: organizationId, data: { capa_id: capaId } })
  }
  return data as CapaRecord
}

/**
 * Founder's Tier 1 authority-gate decision: closing a major/critical CAPA
 * requires human sign-off. Reuses this codebase's own already-established
 * severity threshold (lib/compliance/jobs.ts's compliance.notify_capa
 * treats major/critical the same way) rather than inventing a new one --
 * minor CAPAs close immediately, exactly as transitionCapa always did.
 *
 * On approval the "capa_closure" continuation (registered below) calls
 * transitionCapa for real; on rejection the CAPA is simply left as-is
 * (still in "verification"), since there's nothing to undo.
 */
export async function requestCapaClosure(
  organizationId: string,
  capaId: string,
  notes: string | null,
  userId: string,
): Promise<{ closed: CapaRecord | null; pendingApproval: boolean }> {
  const db = createServiceClient()
  const { data: capaRow } = await db.from("capa_records").select("*").eq("id", capaId).eq("organization_id", organizationId).maybeSingle()
  if (!capaRow) return { closed: null, pendingApproval: false }
  const capa = capaRow as CapaRecord

  if (!canTransition(capa.status, "closed")) {
    return { closed: null, pendingApproval: false }
  }

  if (capa.severity === "minor") {
    const closed = await transitionCapa(organizationId, capaId, "closed", notes, userId)
    return { closed, pendingApproval: false }
  }

  const run = await startWorkflowRun(organizationId, "capa_closure", { capa_id: capaId, notes }, userId)
  if (!run) return { closed: null, pendingApproval: false }

  await raiseHAR({
    organizationId,
    workflowRunId: run.id,
    stepKey: "capa_closure_signoff",
    type: "approve",
    triggerClass: "authority_gate",
    reason: `Close ${capa.severity} CAPA "${capa.title}"?`,
    contextSummary: notes ? `Closing notes: ${notes}` : null,
    triggeredBy: userId,
    assigneeRole: "owner",
    priority: capa.severity === "critical" ? "urgent" : "high",
  })

  return { closed: null, pendingApproval: true }
}

registerContinuation("capa_closure", async (run, har) => {
  if (har.decision !== "approve") return // rejected or edited -- CAPA stays as-is, nothing to finalize
  const capaId = run.context.capa_id as string | undefined
  const notes = (run.context.notes as string | null) ?? null
  // closed_by is the approver (har.acted_by), not the original requester
  // (run.triggered_by) -- they're the one who actually authorized the
  // closure; the requester's identity is already preserved separately via
  // the HAR's triggered_by and the har_actions audit trail.
  if (!capaId || !har.acted_by) return
  await transitionCapa(run.organization_id, capaId, "closed", notes, har.acted_by)
})

export async function listCapa(organizationId: string, status?: CapaStatus): Promise<CapaRecord[]> {
  const db = createServiceClient()
  let q = db.from("capa_records").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
  if (status) q = q.eq("status", status)
  const { data } = await q
  return (data ?? []) as CapaRecord[]
}
