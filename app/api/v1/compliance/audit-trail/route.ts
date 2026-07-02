import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  appendComplianceAudit,
  verifyComplianceAuditChain,
  getComplianceAuditHistory,
  exportComplianceAudit,
} from "@/lib/compliance/audit-trail"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const method = req.method

    if (method === "GET") {
      const recordType = req.nextUrl.searchParams.get("recordType") || undefined
      const recordId = req.nextUrl.searchParams.get("recordId") || undefined
      const format = req.nextUrl.searchParams.get("format")

      if (format === "csv") {
        const csv = await exportComplianceAudit(organizationId, recordType)
        return new NextResponse(csv, {
          headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=compliance-audit.csv" },
        })
      }

      if (recordId) {
        const verification = await verifyComplianceAuditChain(organizationId, recordType || "", recordId)
        return NextResponse.json({ verification, entries: await getComplianceAuditHistory(organizationId, recordType, recordId) })
      }

      const entries = await getComplianceAuditHistory(organizationId, recordType, recordId)
      return NextResponse.json({ entries })
    }

    const body = await req.json() as {
      action: "append" | "verify"
      recordType: string
      recordId: string
      actionType: "CREATE" | "UPDATE" | "DELETE" | "SIGN" | "VERIFY" | "EXPORT" | "ARCHIVE"
      dataSnapshot: Record<string, unknown>
      ipAddress?: string
      metadata?: Record<string, unknown>
    }

    if (body.action === "verify") {
      const result = await verifyComplianceAuditChain(organizationId, body.recordType, body.recordId)
      return NextResponse.json(result)
    }

    const entry = await appendComplianceAudit(
      organizationId,
      body.recordType,
      body.recordId,
      body.actionType,
      body.dataSnapshot,
      userId,
      body.ipAddress || null,
      body.metadata,
    )

    if (!entry) {
      return NextResponse.json({ error: "Failed to create audit entry" }, { status: 500 })
    }

    return NextResponse.json({ entry })
  } catch (err) {
    console.error("[compliance-audit] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export { handler as POST, handler as GET }
