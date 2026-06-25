import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractTenantContext } from "@/lib/multitenant/context"
import { dispatchDocumentEvent } from "@/lib/documents/events"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    const userId = ctx?.userId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 })

    const content = await file.text()
    const fileSize = file.size

    const supabase = createServiceClient()
    const { data: doc, error } = await supabase.from("documents").insert({
      organization_id: orgId, name: file.name, type: "upload",
      content: content.slice(0, 50000), file_size: fileSize,
      mime_type: file.type, classification: null,
      metadata: { source: "upload", original_name: file.name, mime_type: file.type },
    }).select("id").single()

    if (error) throw new Error(error.message)

    dispatchDocumentEvent({
      type: "document.uploaded", organization_id: orgId,
      document_id: doc.id, actor_id: userId ?? null,
      metadata: { source: "upload", file_name: file.name, file_size: fileSize },
    }).catch(() => {})

    return NextResponse.json({ success: true, document: { id: doc.id, name: file.name } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to upload file"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
