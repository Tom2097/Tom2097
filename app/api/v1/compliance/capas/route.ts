"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createCapa, listCapa } from "@/lib/compliance/capa"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"

// GET /api/v1/compliance/capas
export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = req.nextUrl
  const status = searchParams.get("status") as "open" | "investigation" | "action" | "verification" | "closed" | undefined
  const capas = await listCapa(organizationId, status)
  return NextResponse.json(capas)
})

// POST /api/v1/compliance/capas
export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const input = await req.json()
  const capa = await createCapa(organizationId, input, userId)

  if (!capa) {
    return NextResponse.json({ error: "CAPA creation failed" }, { status: 400 })
  }

  await appendComplianceAudit(
    organizationId,
    "capa_records",
    capa.id,
    "CREATE",
    capa,
    userId,
    req.ip
  )

  return NextResponse.json(capa)
})