"use server"

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { computeComplianceScore } from "@/lib/compliance/scoring"

// GET /api/v1/compliance/scores
export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const scores = await computeComplianceScore(organizationId)
  return NextResponse.json(scores)
})