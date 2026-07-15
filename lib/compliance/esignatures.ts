import { createHash, randomUUID } from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export interface SignatureRequest {
  id: string
  organization_id: string
  document_id: string
  document_name: string
  requester_id: string
  signer_email: string
  signer_name: string | null
  signer_phone: string | null
  message: string | null
  status: "pending" | "sent" | "viewed" | "signed" | "rejected" | "expired"
  signature_data: string | null
  signature_hash: string | null
  signed_at: string | null
  signed_ip: string | null
  expires_at: string | null
  viewed_at: string | null
  created_at: string
  updated_at: string
}

export interface SignedDocument {
  id: string
  organization_id: string
  document_id: string
  signer_email: string
  signer_name: string | null
  signature_type: "draw" | "type" | "upload" | "digital_cert"
  signature_data: string
  signature_hash: string
  signed_at: string
  ip_address: string | null
  certificate_info: Record<string, unknown> | null
}

export async function createSignatureRequest(
  organizationId: string,
  documentId: string,
  documentName: string,
  requesterId: string,
  signerEmail: string,
  signerName: string | null = null,
  signerPhone: string | null = null,
  message: string | null = null,
  expiresInDays: number = 30,
): Promise<SignatureRequest | null> {
  const db = createServiceClient()

  const { data, error } = await db.from("esignature_requests").insert({
    organization_id: organizationId,
    document_id: documentId,
    document_name: documentName,
    requester_id: requesterId,
    signer_email: signerEmail,
    signer_name: signerName,
    signer_phone: signerPhone,
    message,
    status: "pending",
    expires_at: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
  }).select("*").single()

  if (error) return null
  const req = data as SignatureRequest

  await publish({
    type: "compliance.signature_requested",
    organization_id: organizationId,
    data: { signature_request_id: req.id, document_id: documentId, signer_email: signerEmail },
  })

  return req
}

export async function signDocument(
  organizationId: string,
  requestId: string,
  signerEmail: string,
  signatureType: "draw" | "type" | "upload" | "digital_cert",
  signatureData: string,
  ipAddress: string | null = null,
  certificateInfo: Record<string, unknown> | null = null,
): Promise<SignedDocument | null> {
  const db = createServiceClient()

  const { data: request } = await db
    .from("esignature_requests")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .eq("signer_email", signerEmail)
    .single()

  if (!request) return null
  const req = request as SignatureRequest
  if (req.status === "signed" || req.status === "rejected" || req.status === "expired") return null

  const signatureHash = createHash("sha256")
    .update(`${signerEmail}|${req.document_id}|${signatureData}|${Date.now()}`)
    .digest("hex")

  const { data, error } = await db.from("esignature_records").insert({
    organization_id: organizationId,
    document_id: req.document_id,
    signer_email: signerEmail,
    signer_name: req.signer_name,
    signature_type: signatureType,
    signature_data: signatureData,
    signature_hash: signatureHash,
    ip_address: ipAddress,
    certificate_info: certificateInfo,
  }).select("*").single()

  if (error) return null

  await db.from("esignature_requests").update({
    status: "signed",
    signature_data: signatureData,
    signature_hash: signatureHash,
    signed_at: new Date().toISOString(),
    signed_ip: ipAddress,
  }).eq("id", requestId)

  await db.from("documents").update({
    signature_status: "signed",
    signed_at: new Date().toISOString(),
    signed_by: signerEmail,
  }).eq("id", req.document_id)

  await publish({
    type: "compliance.document_signed",
    organization_id: organizationId,
    data: { document_id: req.document_id, signer_email: signerEmail, signature_hash: signatureHash },
  })

  return data as SignedDocument
}

export async function verifySignature(
  organizationId: string,
  documentId: string,
  signatureHash: string,
): Promise<{ valid: boolean; record: SignedDocument | null }> {
  const db = createServiceClient()
  const { data } = await db
    .from("esignature_records")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .eq("signature_hash", signatureHash)
    .maybeSingle()

  if (!data) return { valid: false, record: null }
  const record = data as SignedDocument

  const expectedHash = createHash("sha256")
    .update(`${record.signer_email}|${documentId}|${record.signature_data}|${new Date(record.signed_at).getTime()}`)
    .digest("hex")

  return { valid: expectedHash === signatureHash, record }
}

export async function listSignatureRequests(
  organizationId: string,
  status?: SignatureRequest["status"],
): Promise<SignatureRequest[]> {
  const db = createServiceClient()
  let q = db.from("esignature_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
  if (status) q = q.eq("status", status)
  const { data } = await q
  return (data ?? []) as SignatureRequest[]
}

export async function getSignatureRequest(
  organizationId: string,
  requestId: string,
): Promise<SignatureRequest | null> {
  const db = createServiceClient()
  const { data } = await db
    .from("esignature_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle()
  return (data as SignatureRequest) ?? null
}

export async function rejectSignatureRequest(
  organizationId: string,
  requestId: string,
  reason: string | null = null,
): Promise<SignatureRequest | null> {
  const db = createServiceClient()
  const { data: request } = await db
    .from("esignature_requests")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .single()

  if (!request) return null
  const req = request as SignatureRequest
  if (req.status === "signed" || req.status === "rejected" || req.status === "expired") return null

  const { data, error } = await db
    .from("esignature_requests")
    .update({ status: "rejected", message: reason ?? req.message })
    .eq("id", requestId)
    .select("*")
    .single()

  if (error) return null

  await publish({
    type: "compliance.signature_rejected",
    organization_id: organizationId,
    data: { signature_request_id: requestId, reason },
  })

  return data as SignatureRequest
}

export async function getSignatureRecordForDocument(
  organizationId: string,
  documentId: string,
): Promise<SignedDocument | null> {
  const db = createServiceClient()
  const { data } = await db
    .from("esignature_records")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as SignedDocument) ?? null
}
