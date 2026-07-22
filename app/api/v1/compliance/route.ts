"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { computeComplianceScore, generateRequirementTraceabilityMatrix, generateMockAuditQA } from "@/lib/compliance/scoring"

export const POST = withAuth(async (req: NextRequest, { organizationId }) => {
  try {
    const { action, requirements, auditScope } = await req.json()
    if (action === "score") {
      const score = await computeComplianceScore(organizationId)
      return NextResponse.json(score)
    }
    if (action === "traceability") {
      return NextResponse.json(generateRequirementTraceabilityMatrix(requirements || []))
    }
    if (action === "mock-audit") {
      return NextResponse.json(generateMockAuditQA(auditScope || "Full System Audit"))
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}, { requireAny: ["compliance:read", "compliance:write"] })
