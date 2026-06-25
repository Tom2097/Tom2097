import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { classifyDocument } from "@/lib/operational/understanding"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { documentId, content } = await request.json()
    if (!documentId || !content) return NextResponse.json({ error: "documentId and content are required" }, { status: 400 })

    const result = await classifyDocument(orgId, documentId, content)
    if (!result) return NextResponse.json({ error: "Classification failed" }, { status: 500 })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Classification failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
