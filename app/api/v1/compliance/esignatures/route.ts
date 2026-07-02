import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  createSignatureRequest,
  signDocument,
  verifySignature,
  listSignatureRequests,
} from "@/lib/compliance/esignatures"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const method = req.method

    if (method === "GET") {
      const status = req.nextUrl.searchParams.get("status") as any || undefined
      const requests = await listSignatureRequests(organizationId, status)
      return NextResponse.json({ requests })
    }

    const body = await req.json() as {
      action: "request" | "sign" | "verify"
      documentId?: string
      documentName?: string
      signerEmail?: string
      signerName?: string
      signerPhone?: string
      message?: string
      expiresInDays?: number
      requestId?: string
      signatureType?: "draw" | "type" | "upload" | "digital_cert"
      signatureData?: string
      ipAddress?: string
      certificateInfo?: Record<string, unknown>
      signatureHash?: string
    }

    switch (body.action) {
      case "request": {
        if (!body.documentId || !body.signerEmail) {
          return NextResponse.json({ error: "documentId and signerEmail required" }, { status: 400 })
        }
        const req_ = await createSignatureRequest(
          organizationId,
          body.documentId,
          body.documentName || "Document",
          userId,
          body.signerEmail,
          body.signerName || null,
          body.signerPhone || null,
          body.message || null,
          body.expiresInDays || 30,
        )
        if (!req_) return NextResponse.json({ error: "Failed to create signature request" }, { status: 500 })
        return NextResponse.json({ request: req_ })
      }
      case "sign": {
        if (!body.requestId || !body.signerEmail || !body.signatureType || !body.signatureData) {
          return NextResponse.json({ error: "requestId, signerEmail, signatureType, and signatureData required" }, { status: 400 })
        }
        const signed = await signDocument(
          organizationId,
          body.requestId,
          body.signerEmail,
          body.signatureType,
          body.signatureData,
          body.ipAddress || null,
          body.certificateInfo || null,
        )
        if (!signed) return NextResponse.json({ error: "Failed to sign document" }, { status: 500 })
        return NextResponse.json({ signed })
      }
      case "verify": {
        if (!body.documentId || !body.signatureHash) {
          return NextResponse.json({ error: "documentId and signatureHash required" }, { status: 400 })
        }
        const result = await verifySignature(organizationId, body.documentId, body.signatureHash)
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (err) {
    console.error("[esignatures] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export { handler as POST, handler as GET }
