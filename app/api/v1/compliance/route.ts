import { NextRequest, NextResponse } from "next/server"
import { calculateComplianceScore, generateRequirementTraceabilityMatrix, generateMockAuditQA } from "@/lib/compliance/scoring"

export async function POST(req: NextRequest) {
  try {
    const { action, organizationId, requirements, auditScope } = await req.json()
    if (action === "score") {
      return NextResponse.json(calculateComplianceScore(organizationId))
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
}
