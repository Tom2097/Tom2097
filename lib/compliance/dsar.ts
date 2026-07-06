import { createServiceClient } from "@/lib/supabase/service"

export interface DsarRequest {
  id: string
  organization_id: string
  requester_email: string
  request_type: "export" | "delete" | "rectify" | "restrict"
  status: "pending" | "in_progress" | "completed" | "rejected"
  data: Record<string, unknown> | null
  completed_at: string | null
  created_at: string
}

export async function createDsarRequest(
  organizationId: string,
  requesterEmail: string,
  requestType: DsarRequest["request_type"],
): Promise<DsarRequest | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("dsar_requests")
    .insert({ organization_id: organizationId, requester_email: requesterEmail, request_type: requestType, status: "pending" })
    .select("*")
    .single()
  if (error) return null
  return data as DsarRequest
}

export async function executeDsarExport(organizationId: string, userId: string): Promise<Record<string, unknown>> {
  const db = createServiceClient()

  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).single()
  const { data: activities } = await db.from("auth_audit_logs").select("*").eq("organization_id", organizationId).eq("user_id", userId)
  const { data: documents } = await db.from("documents").select("id, name, type, created_at").eq("organization_id", organizationId).eq("uploaded_by", userId)
  const { data: consent } = await db.from("consent_records").select("*").eq("organization_id", organizationId).eq("user_id", userId)

  return {
    profile: profile ?? {},
    activities: activities ?? [],
    documents: documents ?? [],
    consent_records: consent ?? [],
    exported_at: new Date().toISOString(),
  }
}

export async function executeDsarDelete(organizationId: string, userId: string): Promise<boolean> {
  const db = createServiceClient()
  const tables = ["profiles", "consent_records", "oauth_accounts", "magic_link_tokens", "user_preferences"]
  for (const table of tables) {
    await db.from(table).delete().eq("id", userId).maybeSingle()
    await db.from(table).delete().eq("user_id", userId)
  }
  await db.auth.admin.deleteUser(userId)
  return true
}

export async function listDsarRequests(organizationId: string): Promise<DsarRequest[]> {
  const db = createServiceClient()
  const { data } = await db.from("dsar_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
  return (data ?? []) as DsarRequest[]
}

export interface ConsentRecord {
  id: string
  organization_id: string
  user_id: string
  purpose: string
  granted: boolean
  granted_at: string
  revoked_at: string | null
  ip_address?: string
  user_agent?: string
}

export async function recordConsent(
  organizationId: string,
  userId: string,
  purpose: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from("consent_records").insert({
    organization_id: organizationId,
    user_id: userId,
    purpose,
    granted: true,
    granted_at: new Date().toISOString(),
    ip_address: ipAddress,
    user_agent: userAgent,
  })
  return !error
}

export async function revokeConsent(
  organizationId: string,
  userId: string,
  purpose: string
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from("consent_records")
    .update({ granted: false, revoked_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("purpose", purpose)
  return !error
}

export async function listConsentRecords(
  organizationId: string,
  userId?: string
): Promise<ConsentRecord[]> {
  const db = createServiceClient()
  let query = db.from("consent_records").select("*").eq("organization_id", organizationId)
  if (userId) {
    query = query.eq("user_id", userId)
  }
  const { data } = await query.order("granted_at", { ascending: false })
  return (data ?? []) as ConsentRecord[]
}

export async function updateDsarStatus(
  requestId: string,
  status: DsarRequest["status"]
): Promise<boolean> {
  const db = createServiceClient()
  const update: Record<string, unknown> = { status }
  if (status === "completed") {
    update.completed_at = new Date().toISOString()
  }
  const { error } = await db.from("dsar_requests").update(update).eq("id", requestId)
  return !error
}

export async function getDsarExportData(
  organizationId: string,
  userId: string
): Promise<Record<string, unknown>> {
  return executeDsarExport(organizationId, userId)
}

export async function executeDsarRectify(
  organizationId: string,
  userId: string,
  field: string,
  value: string
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from("profiles")
    .update({ [field]: value })
    .eq("id", userId)
    .eq("organization_id", organizationId)
  return !error
}

export async function executeDsarRestrict(
  organizationId: string,
  userId: string,
  restricted: boolean
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from("profiles")
    .update({ data_processing_restricted: restricted, restricted_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("organization_id", organizationId)
  return !error
}
