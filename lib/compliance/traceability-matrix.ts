import { createServiceClient } from "@/lib/supabase/service"

export interface TraceabilityEntry {
  id: string
  organizationId: string
  framework: string
  controlId: string
  controlTitle: string
  controlDescription: string
  evidenceId?: string
  evidenceName?: string
  evidenceStatus: "mapped" | "partial" | "missing" | "expired"
  score: number // 0-100
  lastVerifiedAt?: string
  notes?: string
}

export interface TraceabilitySummary {
  totalControls: number
  mapped: number
  partial: number
  missing: number
  expired: number
  overallScore: number
  frameworkBreakdown: Array<{
    framework: string
    total: number
    mapped: number
    score: number
  }>
}

export async function buildTraceabilityMatrix(
  organizationId: string,
  frameworkIds: string[]
): Promise<TraceabilityEntry[]> {
  const supabase = await createServiceClient()

  // Get framework controls
  const { data: controls } = await supabase
    .from("compliance_frameworks")
    .select(`
      id, name, description,
      compliance_controls (id, control_id, title, description)
    `)
    .in("id", frameworkIds)

  if (!controls) return []

  // Get existing evidence for this organization
  const { data: evidence } = await supabase
    .from("compliance_evidence")
    .select("id, name, control_id, status, expires_at, created_at")
    .eq("organization_id", organizationId)

  const evidenceMap = new Map<string, Record<string, unknown>>()
  for (const ev of (evidence || []) as Array<Record<string, unknown>>) {
    evidenceMap.set(ev.control_id as string, ev)
  }

  const entries: TraceabilityEntry[] = []

  for (const framework of (controls || []) as Array<Record<string, unknown>>) {
    const frameworkControls = (framework.compliance_controls as Array<Record<string, unknown>>) || []
    
    for (const control of frameworkControls) {
      const existingEvidence = evidenceMap.get(control.control_id as string)
      const isExpired = existingEvidence?.expires_at 
        ? new Date(existingEvidence.expires_at as string) < new Date()
        : false

      let evidenceStatus: TraceabilityEntry["evidenceStatus"] = "missing"
      let score = 0

      if (existingEvidence && !isExpired) {
        evidenceStatus = "mapped"
        score = 100
      } else if (existingEvidence && isExpired) {
        evidenceStatus = "expired"
        score = 25
      } else {
        // Check for partial matches via naming similarity
        const partialMatches = (evidence || []).filter((ev: Record<string, unknown>) =>
          (ev.control_id as string || "").includes((control.control_id as string).split(".")[0])
        )
        if (partialMatches.length > 0) {
          evidenceStatus = "partial"
          score = 50
        }
      }

      entries.push({
        id: `${framework.id}-${control.control_id}`,
        organizationId,
        framework: framework.name as string,
        controlId: control.control_id as string,
        controlTitle: control.title as string,
        controlDescription: control.description as string || "",
        evidenceId: existingEvidence?.id as string | undefined,
        evidenceName: existingEvidence?.name as string | undefined,
        evidenceStatus,
        score,
        lastVerifiedAt: existingEvidence?.created_at as string | undefined,
      })
    }
  }

  // Store matrix
  await supabase
    .from("traceability_matrices")
    .upsert(
      entries.map(e => ({
        organization_id: e.organizationId,
        framework: e.framework,
        control_id: e.controlId,
        control_title: e.controlTitle,
        evidence_status: e.evidenceStatus,
        score: e.score,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "organization_id,framework,control_id" }
    )

  return entries
}

export async function getTraceabilitySummary(
  organizationId: string
): Promise<TraceabilitySummary | null> {
  const supabase = await createServiceClient()

  const { data: entries } = await supabase
    .from("traceability_matrices")
    .select("*")
    .eq("organization_id", organizationId)

  if (!entries || entries.length === 0) return null

  const frameworkMap = new Map<string, { total: number; mapped: number }>()

  for (const entry of (entries as Array<Record<string, unknown>>)) {
    const framework = entry.framework as string
    if (!frameworkMap.has(framework)) {
      frameworkMap.set(framework, { total: 0, mapped: 0 })
    }
    const f = frameworkMap.get(framework)!
    f.total++
    if (entry.evidence_status === "mapped") f.mapped++
  }

  const mapped = entries.filter((e: Record<string, unknown>) => e.evidence_status === "mapped").length
  const partial = entries.filter((e: Record<string, unknown>) => e.evidence_status === "partial").length
  const missing = entries.filter((e: Record<string, unknown>) => e.evidence_status === "missing").length
  const expired = entries.filter((e: Record<string, unknown>) => e.evidence_status === "expired").length
  const overallScore = entries.length > 0 ? Math.round((mapped / entries.length) * 100) : 0

  return {
    totalControls: entries.length,
    mapped,
    partial,
    missing,
    expired,
    overallScore,
    frameworkBreakdown: Array.from(frameworkMap.entries()).map(([framework, data]) => ({
      framework,
      total: data.total,
      mapped: data.mapped,
      score: data.total > 0 ? Math.round((data.mapped / data.total) * 100) : 0,
    })),
  }
}

export async function analyzeGaps(
  organizationId: string
): Promise<Array<{ controlId: string; controlTitle: string; framework: string; gapType: string; recommendation: string }>> {
  const entries = await buildTraceabilityMatrix(organizationId, [])
  const gaps = entries
    .filter(e => e.evidenceStatus === "missing" || e.evidenceStatus === "expired")
    .map(e => ({
      controlId: e.controlId,
      controlTitle: e.controlTitle,
      framework: e.framework,
      gapType: e.evidenceStatus === "missing" ? "no_evidence" : "evidence_expired",
      recommendation: e.evidenceStatus === "missing"
        ? `Upload evidence for control ${e.controlId}: ${e.controlTitle}`
        : `Renew expired evidence for control ${e.controlId}: ${e.controlTitle}`,
    }))
  return gaps
}
