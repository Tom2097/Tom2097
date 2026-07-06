"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getComplianceAuditHistory } from "@/lib/compliance/audit-trail"

// GET /api/v1/compliance/audit-trail
export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = req.nextUrl
  const recordType = searchParams.get("record_type") ?? undefined
  const recordId = searchParams.get("record_id") ?? undefined
  const limit = parseInt(searchParams.get("limit") ?? "100")

  const entries = await getComplianceAuditHistory(
    organizationId,
    recordType,
    recordId,
    limit
  )

  return NextResponse.json(entries)
})