import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { textToSql, guardQuery } from "@/lib/analytics/text-to-sql"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { question, execute } = await request.json()
    if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 })

    const result = await textToSql(question, orgId)
    if (!result.sql) return NextResponse.json({ error: result.explanation }, { status: 400 })

    const guarded = guardQuery(result.sql)

    return NextResponse.json({
      success: true,
      data: {
        sql: result.sql,
        explanation: result.explanation,
        confidence: result.confidence,
        guarded: { allowed: guarded.allowed, reason: guarded.reason },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Text-to-SQL failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
