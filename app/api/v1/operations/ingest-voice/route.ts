import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractTenantContext } from "@/lib/multitenant/context"
import { dispatchDocumentEvent } from "@/lib/documents/events"
import { classifyText } from "@/lib/analytics/nlp"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    const userId = ctx?.userId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { transcript, fileName } = await request.json()
    if (!transcript) return NextResponse.json({ error: "transcript is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data: doc, error } = await supabase.from("documents").insert({
      organization_id: orgId, name: fileName ?? "Voice Note", type: "voice_transcript",
      content: transcript, classification: null,
      metadata: { source: "voice_note" },
    }).select("id").single()

    if (error) throw new Error(error.message)

    classifyText(transcript.slice(0, 5000)).then(async (result) => {
      if (result.primary) {
        await supabase.from("documents").update({ classification: result.primary }).eq("id", doc.id)
      }
    }).catch(() => {})

    dispatchDocumentEvent({
      type: "document.created", organization_id: orgId,
      document_id: doc.id, actor_id: userId ?? null,
      metadata: { source: "voice_note" },
    }).catch(() => {})

    return NextResponse.json({ success: true, document_id: doc.id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to ingest voice note"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
