import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { extractDocumentEntities } from "@/lib/operational/understanding"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { documentId, content } = await request.json()
    if (!documentId || !content) return NextResponse.json({ error: "documentId and content are required" }, { status: 400 })

    const entities = await extractDocumentEntities(orgId, documentId, content)
    return NextResponse.json({ success: true, data: entities ?? [] })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Entity extraction failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
