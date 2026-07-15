"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  getSignatureRequest,
  signDocument,
  rejectSignatureRequest,
  getSignatureRecordForDocument,
} from "@/lib/compliance/esignatures"
import { appendComplianceAudit, getComplianceAuditHistory, verifyComplianceAuditChain } from "@/lib/compliance/audit-trail"
import { getClientIp } from "@/lib/auth/audit"

// GET /api/v1/compliance/esignatures/[id]
export const GET = withAuth(async (_req: NextRequest, { params, organizationId }) => {
  const { id } = params
  const request = await getSignatureRequest(organizationId, id)
  if (!request) {
    return NextResponse.json({ error: "Signature request not found" }, { status: 404 })
  }

  const history = await getComplianceAuditHistory(organizationId, "esignature_requests", id)
  const auditTrail = history
    .slice()
    .reverse()
    .map((entry) => ({
      timestamp: entry.created_at,
      action: entry.action.toLowerCase(),
      user: entry.changed_by ?? "system",
      ipAddress: entry.ip_address ?? "-",
      details: `${entry.action} recorded for ${entry.record_type}`,
    }))

  return NextResponse.json({ request: { ...request, auditTrail } })
})

// PATCH /api/v1/compliance/esignatures/[id]
export const PATCH = withAuth(async (req: NextRequest, { params, organizationId, userId }) => {
  const { id } = params
  const body = await req.json()
  const ip = getClientIp(req.headers)

  if (body.action === "sign") {
    const request = await getSignatureRequest(organizationId, id)
    if (!request) return NextResponse.json({ error: "Signature request not found" }, { status: 404 })

    const signatureData = typeof body.signatureData === "string" && body.signatureData.trim()
      ? body.signatureData.trim()
      : null
    if (!signatureData) {
      return NextResponse.json({ error: "signatureData (typed name) is required" }, { status: 400 })
    }

    const record = await signDocument(organizationId, id, request.signer_email, "type", signatureData, ip)
    if (!record) return NextResponse.json({ error: "Failed to sign document" }, { status: 400 })

    await appendComplianceAudit(organizationId, "esignature_requests", id, "SIGN", record as unknown as Record<string, unknown>, userId, ip)
    return NextResponse.json({ success: true, record })
  }

  if (body.action === "reject") {
    const updated = await rejectSignatureRequest(organizationId, id, body.reason ?? null)
    if (!updated) return NextResponse.json({ error: "Failed to reject signature request" }, { status: 400 })

    await appendComplianceAudit(organizationId, "esignature_requests", id, "UPDATE", updated as unknown as Record<string, unknown>, userId, ip, { rejected: true })
    return NextResponse.json({ success: true, request: updated })
  }

  if (body.action === "verify") {
    const request = await getSignatureRequest(organizationId, id)
    if (!request) return NextResponse.json({ error: "Signature request not found" }, { status: 404 })

    const chain = await verifyComplianceAuditChain(organizationId, "esignature_requests", id)
    const record = await getSignatureRecordForDocument(organizationId, request.document_id)

    await appendComplianceAudit(organizationId, "esignature_requests", id, "VERIFY", { chainValid: chain.valid }, userId, ip)

    return NextResponse.json({
      valid: chain.valid && (!record || Boolean(record.signature_hash)),
      chain,
    })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
})
