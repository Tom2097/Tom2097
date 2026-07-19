"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { appendComplianceAudit } from "@/lib/compliance/audit-trail"
import { getClientIp } from "@/lib/auth/audit"

// GET /api/v1/compliance/frameworks
export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const db = createServiceClient()
  const { data } = await db
    .from("compliance_frameworks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  return NextResponse.json(data ?? [])
}, { requireAny: ["compliance:read", "compliance:write"] })

// POST /api/v1/compliance/frameworks
export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const { name, description, controls_count } = await req.json()
  const db = createServiceClient()

  const { data, error } = await db
    .from("compliance_frameworks")
    .insert({
      organization_id: organizationId,
      name,
      description,
      controls_count,
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await appendComplianceAudit(
    organizationId,
    "compliance_frameworks",
    data.id,
    "CREATE",
    data as Record<string, unknown>,
    userId,
    getClientIp(req.headers)
  )

  return NextResponse.json(data)
}, { requireAny: ["compliance:write"] })