import { createServiceClient } from "@/lib/supabase/service"
import { createAuditEntry } from "@/lib/audit/append-only"
import { randomUUID } from "crypto"

export interface Incident {
  id: string
  organizationId: string
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low"
  status: "detected" | "investigating" | "mitigated" | "resolved"
  assignedTo?: string
  detectedAt: string
  resolvedAt?: string
  runbookId?: string
}

export interface Runbook {
  id: string
  title: string
  description: string
  steps: Array<{ order: number; action: string; expectedOutcome: string }>
  category: "security" | "infrastructure" | "application" | "compliance"
}

export async function reportIncident(
  organizationId: string,
  title: string,
  description: string,
  severity: Incident["severity"]
): Promise<Incident | null> {
  const supabase = await createServiceClient()
  const id = randomUUID()
  
  const { data } = await supabase
    .from("incidents")
    .insert({
      id,
      organization_id: organizationId,
      title,
      description,
      severity,
      status: "detected",
      detected_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (!data) return null

  return {
    id: data.id,
    organizationId: data.organization_id,
    title: data.title,
    description: data.description,
    severity: data.severity,
    status: data.status,
    assignedTo: data.assigned_to,
    detectedAt: data.detected_at,
    resolvedAt: data.resolved_at,
    runbookId: data.runbook_id,
  }
}

export const DEFAULT_RUNBOOKS: Runbook[] = [
  {
    id: "rb-security-breach",
    title: "Security Breach Response",
    description: "Standard response procedure for security incidents",
    category: "security",
    steps: [
      { order: 1, action: "Isolate affected systems from network", expectedOutcome: "Containment achieved" },
      { order: 2, action: "Collect forensic data and logs", expectedOutcome: "Evidence preserved" },
      { order: 3, action: "Rotate all credentials and API keys", expectedOutcome: "Access revoked" },
      { order: 4, action: "Notify affected users and stakeholders", expectedOutcome: "All parties informed" },
      { order: 5, action: "Initiate root cause analysis", expectedOutcome: "RCA documented" },
    ],
  },
  {
    id: "rb-service-down",
    title: "Service Outage Response",
    description: "Procedure for handling service degradation or outage",
    category: "infrastructure",
    steps: [
      { order: 1, action: "Verify service health across all regions", expectedOutcome: "Outage scope identified" },
      { order: 2, action: "Check recent deployments and changes", expectedOutcome: "Root cause identified" },
      { order: 3, action: "Rollback or deploy fix", expectedOutcome: "Service restored" },
      { order: 4, action: "Verify all dependent services", expectedOutcome: "Full recovery confirmed" },
    ],
  },
  {
    id: "rb-data-breach",
    title: "Data Breach Response",
    description: "Regulatory-compliant data breach handling procedure",
    category: "compliance",
    steps: [
      { order: 1, action: "Document breach details and scope", expectedOutcome: "Breach documented" },
      { order: 2, action: "Notify DPO and legal team", expectedOutcome: "Legal notified" },
      { order: 3, action: "Assess regulatory notification requirements", expectedOutcome: "Compliance timeline established" },
      { order: 4, action: "Notify supervisory authority within 72h", expectedOutcome: "Regulatory compliance met" },
      { order: 5, action: "Implement additional security controls", expectedOutcome: "Recurrence prevented" },
    ],
  },
]

export async function getIncidents(organizationId: string, status?: string): Promise<Incident[]> {
  const supabase = await createServiceClient()
  let query = supabase.from("incidents").select("*").eq("organization_id", organizationId)
  if (status) query = query.eq("status", status)
  const { data } = await query.order("detected_at", { ascending: false })
  return ((data as Record<string, unknown>[]) || []).map(i => ({
    id: i.id as string,
    organizationId: i.organization_id as string,
    title: i.title as string,
    description: i.description as string,
    severity: i.severity as Incident["severity"],
    status: i.status as Incident["status"],
    assignedTo: i.assigned_to as string | undefined,
    detectedAt: i.detected_at as string,
    resolvedAt: i.resolved_at as string | undefined,
    runbookId: i.runbook_id as string | undefined,
  }))
}
