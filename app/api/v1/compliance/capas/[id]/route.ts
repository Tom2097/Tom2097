"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { transitionCapa, requestCapaClosure, listCapa } from "@/lib/compliance/capa"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { getClientIp } from "@/lib/auth/audit"

// GET /api/v1/compliance/capas/[id]
export const GET = withAuth(async (req: NextRequest, { params, organizationId, userId }) => {
  const { id } = params
  const capas = await listCapa(organizationId, undefined)
  const capa = capas.find((c) => c.id === id)

  if (!capa) {
    return NextResponse.json({ error: "CAPA not found" }, { status: 404 })
  }

  return NextResponse.json(capa)
}, { requireAny: ["capas:read", "compliance:read"] })

// PATCH /api/v1/compliance/capas/[id]
export const PATCH = withAuth(async (req: NextRequest, { params, organizationId, userId }) => {
  const { id } = params
  const { status, notes } = await req.json()

  // Closing a major/critical CAPA is an authority gate (founder's Tier 1
  // decision) -- requestCapaClosure decides whether to close immediately
  // (minor severity) or pause for sign-off instead.
  if (status === "closed") {
    const { closed, pendingApproval } = await requestCapaClosure(organizationId, id, notes ?? null, userId)
    if (pendingApproval) {
      return NextResponse.json({ pendingApproval: true, message: "Closure requires sign-off; a request has been raised." })
    }
    if (!closed) {
      return NextResponse.json({ error: "CAPA transition failed" }, { status: 400 })
    }
    await appendComplianceAudit(organizationId, "capa_records", id, "UPDATE", closed as unknown as Record<string, unknown>, userId, getClientIp(req.headers))
    return NextResponse.json(closed)
  }

  const updatedCapa = await transitionCapa(organizationId, id, status, notes, userId)
  if (!updatedCapa) {
    return NextResponse.json({ error: "CAPA transition failed" }, { status: 400 })
  }

  await appendComplianceAudit(
    organizationId,
    "capa_records",
    id,
    "UPDATE",
    updatedCapa as unknown as Record<string, unknown>,
    userId,
    getClientIp(req.headers)
  )

  return NextResponse.json(updatedCapa)
}, { requireAny: ["capas:write", "compliance:write"] })