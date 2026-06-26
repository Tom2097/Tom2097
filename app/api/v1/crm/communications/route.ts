import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { sendCommunication, listCommunications } from "@/lib/crm/extensions"
import type { CommunicationInput, CommunicationChannel } from "@/lib/crm/types"

export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = new URL(req.url)
  const result = await listCommunications(organizationId, {
    channel: searchParams.get("channel") as CommunicationChannel | undefined,
    contactId: searchParams.get("contactId") ?? undefined,
    dealId: searchParams.get("dealId") ?? undefined,
    limit: Number(searchParams.get("limit")) || 50,
    offset: Number(searchParams.get("offset")) || 0,
  })
  return NextResponse.json(result)
}, { requireAll: ["crm:read"] })

export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const body: CommunicationInput = await req.json()
  if (!body.subject || !body.body || !body.to_address) {
    return NextResponse.json({ error: "subject, body, and to_address are required" }, { status: 400 })
  }
  const comm = await sendCommunication(organizationId, userId, body)
  return NextResponse.json(comm, { status: 201 })
}, { requireAll: ["crm:write"] })
