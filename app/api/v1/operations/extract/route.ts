import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { extractDocumentFields } from "@/lib/operational/understanding"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { documentId, content, schemaName } = await request.json()
    if (!documentId || !content) return NextResponse.json({ error: "documentId and content are required" }, { status: 400 })

    const fields = await extractDocumentFields(orgId, documentId, content, schemaName)
    return NextResponse.json({ success: true, data: fields, count: fields.length })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Extraction failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
