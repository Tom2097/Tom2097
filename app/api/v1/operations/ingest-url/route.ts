import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractTenantContext } from "@/lib/multitenant/context"
import { classifyText } from "@/lib/analytics/nlp"
import { dispatchDocumentEvent } from "@/lib/documents/events"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    const userId = ctx?.userId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { url } = await request.json()
    if (!url || typeof url !== "string") return NextResponse.json({ error: "url is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        organization_id: orgId,
        name: url,
        type: "web_clip",
        classification: null,
        content: url,
        raw_data: { source_url: url },
        file_size: 0,
      })
      .select("id")
      .single()

    if (error) throw new Error(error.message)

    classifyText(url).then(async (result) => {
      if (result.primary) {
        await supabase.from("documents").update({ classification: result.primary }).eq("id", doc.id)
      }
    }).catch(() => {})

    dispatchDocumentEvent({
      type: "document.created",
      organization_id: orgId,
      document_id: doc.id,
      actor_id: userId ?? null,
      metadata: { source: "url", url },
    }).catch(() => {})

    return NextResponse.json({ success: true, document_id: doc.id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to ingest URL"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
