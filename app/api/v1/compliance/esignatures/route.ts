"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createSignatureRequest, listSignatureRequests, type SignatureRequest } from "@/lib/compliance/esignatures"

// GET /api/v1/compliance/esignatures
export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const status = req.nextUrl.searchParams.get("status") as SignatureRequest["status"] | null
  const requests = await listSignatureRequests(organizationId, status ?? undefined)
  return NextResponse.json({ requests })
})

// POST /api/v1/compliance/esignatures
export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const { documentId, documentName, signerEmail, signerName, signerPhone, message, expiresInDays } = await req.json()

  if (!documentId || !documentName || !signerEmail) {
    return NextResponse.json({ error: "documentId, documentName, and signerEmail are required" }, { status: 400 })
  }

  const request = await createSignatureRequest(
    organizationId,
    documentId,
    documentName,
    userId,
    signerEmail,
    signerName ?? null,
    signerPhone ?? null,
    message ?? null,
    typeof expiresInDays === "number" ? expiresInDays : 30,
  )

  if (!request) {
    return NextResponse.json({ error: "Failed to create signature request" }, { status: 400 })
  }

  return NextResponse.json({ request })
})
