import { createHash, randomUUID } from "crypto"
import { createServiceClient } from "@/lib/supabase/service"

export interface ComplianceAuditEntry {
  id: string
  organization_id: string
  record_type: string
  record_id: string
  action: "CREATE" | "UPDATE" | "DELETE" | "SIGN" | "VERIFY" | "EXPORT" | "ARCHIVE"
  previous_hash: string | null
  hash: string
  data_snapshot: Record<string, unknown>
  changed_by: string | null
  ip_address: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export function computeComplianceHash(
  previousHash: string | null,
  recordType: string,
  recordId: string,
  action: string,
  snapshot: Record<string, unknown>,
): string {
  const content = `${previousHash || "genesis"}|${recordType}|${recordId}|${action}|${JSON.stringify(snapshot)}`
  return createHash("sha256").update(content).digest("hex")
}

export async function appendComplianceAudit(
  organizationId: string,
  recordType: string,
  recordId: string,
  action: ComplianceAuditEntry["action"],
  dataSnapshot: Record<string, unknown>,
  changedBy: string | null,
  ipAddress: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<ComplianceAuditEntry | null> {
  const db = createServiceClient()

  const { data: lastEntry } = await db
    .from("compliance_audit_trail")
    .select("hash")
    .eq("organization_id", organizationId)
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

   const previousHash = (lastEntry as { hash?: string })?.hash || null
  const hash = computeComplianceHash(previousHash, recordType, recordId, action, dataSnapshot)

  const { data, error } = await db.from("compliance_audit_trail").insert({
    organization_id: organizationId,
    record_type: recordType,
    record_id: recordId,
    action,
    previous_hash: previousHash,
    hash,
    data_snapshot: dataSnapshot,
    changed_by: changedBy,
    ip_address: ipAddress,
    metadata,
  }).select("*").single()

  if (error) return null
  return data as ComplianceAuditEntry
}

export async function verifyComplianceAuditChain(
  organizationId: string,
  recordType: string,
  recordId: string,
): Promise<{ valid: boolean; entries: number; brokenAt?: number }> {
  const db = createServiceClient()
  const { data } = await db
    .from("compliance_audit_trail")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .order("created_at", { ascending: true })

  const entries = (data ?? []) as ComplianceAuditEntry[]
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const expectedPrevious = i === 0 ? null : entries[i - 1].hash
    if (e.previous_hash !== expectedPrevious) {
      return { valid: false, entries: entries.length, brokenAt: i }
    }
    const expectedHash = computeComplianceHash(
      e.previous_hash, e.record_type, e.record_id, e.action, e.data_snapshot
    )
    if (e.hash !== expectedHash) {
      return { valid: false, entries: entries.length, brokenAt: i }
    }
  }
  return { valid: true, entries: entries.length }
}

export async function getComplianceAuditHistory(
  organizationId: string,
  recordType?: string,
  recordId?: string,
  limit = 100,
): Promise<ComplianceAuditEntry[]> {
  const db = createServiceClient()
  let q = db
    .from("compliance_audit_trail")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (recordType) q = q.eq("record_type", recordType)
  if (recordId) q = q.eq("record_id", recordId)

  const { data } = await q
  return (data ?? []) as ComplianceAuditEntry[]
}

export async function exportComplianceAudit(
  organizationId: string,
  recordType?: string,
): Promise<string> {
  const entries = await getComplianceAuditHistory(organizationId, recordType)
  const header = "id,created_at,record_type,record_id,action,hash,previous_hash,changed_by"
  const rows = entries.map((e) =>
    [e.id, e.created_at, e.record_type, e.record_id, e.action, e.hash, e.previous_hash || "", e.changed_by || ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  )
  return [header, ...rows].join("\n")
}
