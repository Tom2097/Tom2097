"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createCapa, transitionCapa, listCapa } from "@/lib/compliance/capa"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"

// GET /api/v1/compliance/capas/[id]
export const GET = withAuth(async (req: NextRequest, { params, organizationId, userId }) => {
  const { id } = params
  const capas = await listCapa(organizationId, undefined)
  const capa = capas.find((c) => c.id === id)

  if (!capa) {
    return NextResponse.json({ error: "CAPA not found" }, { status: 404 })
  }

  return NextResponse.json(capa)
})

// PATCH /api/v1/compliance/capas/[id]
export const PATCH = withAuth(async (req: NextRequest, { params, organizationId, userId }) => {
  const { id } = params
  const { status, notes } = await req.json()

  const updatedCapa = await transitionCapa(organizationId, id, status, notes, userId)
  if (!updatedCapa) {
    return NextResponse.json({ error: "CAPA transition failed" }, { status: 400 })
  }

  await appendComplianceAudit(
    organizationId,
    "capa_records",
    id,
    "UPDATE",
    updatedCapa,
    userId,
    req.ip
  )

  return NextResponse.json(updatedCapa)
})