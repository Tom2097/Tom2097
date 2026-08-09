import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"
import { startWorkflowRun } from "@/lib/hitl/workflow-runs"
import { raiseHAR } from "@/lib/hitl/har"
import { registerContinuation } from "@/lib/hitl/continuations"

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
  requesterId: string,
  signerEmail: string,
  signerName: string | null = null,
  signerPhone: string | null = null,
  message: string | null = null,
  expiresInDays: number = 30,
): Promise<SignatureRequest | null> {
  const db = createServiceClient()

  // The service role bypasses RLS. Resolve the document inside the caller's
  // tenant and derive its name server-side so a foreign document UUID cannot
  // be attached to a request in the attacker's organization.
  const { data: document, error: documentError } = await db
    .from("documents")
    .select("id, name")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (documentError || !document) return null

  const { data, error } = await db.from("esignature_requests").insert({
    organization_id: organizationId,
    document_id: documentId,
    document_name: document.name,
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

/**
 * Founder's Tier 1 authority-gate decision: e-signature / contract
 * finalization. The gate sits before the request is SENT to the external
 * signer, not before signDocument() -- signDocument is the external
 * signer's own act (no internal actor to route a HAR to, and gating it
 * wouldn't stop anything: the document has already gone out by then). This
 * is the real, internally-actionable control point: an authorized person
 * must approve sending a document out for a legally-binding signature.
 *
 * On approval the "esignature_send" continuation (registered below) calls
 * createSignatureRequest for real; on rejection nothing is sent.
 */
export async function requestSignatureWithApproval(
  organizationId: string,
  documentId: string,
  requesterId: string,
  signerEmail: string,
  signerName: string | null = null,
  signerPhone: string | null = null,
  message: string | null = null,
  expiresInDays: number = 30,
): Promise<{ request: SignatureRequest | null; pendingApproval: boolean }> {
  const db = createServiceClient()
  const { data: document } = await db
    .from("documents")
    .select("id, name")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (!document) return { request: null, pendingApproval: false }

  const run = await startWorkflowRun(
    organizationId,
    "esignature_send",
    { document_id: documentId, signer_email: signerEmail, signer_name: signerName, signer_phone: signerPhone, message, expires_in_days: expiresInDays },
    requesterId,
  )
  if (!run) return { request: null, pendingApproval: false }

  await raiseHAR({
    organizationId,
    workflowRunId: run.id,
    stepKey: "esignature_send_signoff",
    type: "approve",
    triggerClass: "authority_gate",
    reason: `Send "${document.name}" to ${signerEmail} for signature?`,
    contextSummary: message ? `Message to signer: ${message}` : null,
    triggeredBy: requesterId,
    assigneeRole: "owner",
    priority: "high",
  })

  return { request: null, pendingApproval: true }
}

registerContinuation("esignature_send", async (run, har) => {
  if (har.decision !== "approve") return // rejected or edited -- never send
  const ctx = run.context as {
    document_id?: string
    signer_email?: string
    signer_name?: string | null
    signer_phone?: string | null
    message?: string | null
    expires_in_days?: number
  }
  if (!ctx.document_id || !ctx.signer_email || !run.triggered_by) return
  await createSignatureRequest(
    run.organization_id,
    ctx.document_id,
    run.triggered_by,
    ctx.signer_email,
    ctx.signer_name ?? null,
    ctx.signer_phone ?? null,
    ctx.message ?? null,
    ctx.expires_in_days ?? 30,
  )
})

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
  })
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .eq("signer_email", signerEmail)

  await db.from("documents").update({
    signature_status: "signed",
    signed_at: new Date().toISOString(),
    signed_by: signerEmail,
  })
    .eq("id", req.document_id)
    .eq("organization_id", organizationId)

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
    .eq("organization_id", organizationId)
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
