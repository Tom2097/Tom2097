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
