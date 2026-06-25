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

    const { from, subject, body, attachments } = await request.json()
    if (!from || !body) return NextResponse.json({ error: "from and body are required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data: doc, error } = await supabase.from("documents").insert({
      organization_id: orgId, name: `Email: ${subject ?? "(no subject)"}`, type: "email",
      content: body, classification: null,
      metadata: { source: "email", from, subject: subject ?? null },
    }).select("id").single()

    if (error) throw new Error(error.message)

    classifyText(body.slice(0, 5000)).then(async (result) => {
      if (result.primary) {
        await supabase.from("documents").update({ classification: result.primary }).eq("id", doc.id)
      }
    }).catch(() => {})

    dispatchDocumentEvent({
      type: "document.created", organization_id: orgId,
      document_id: doc.id, actor_id: userId ?? null,
      metadata: { source: "email", from, subject },
    }).catch(() => {})

    const attachmentIds: string[] = []
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        const { data: attDoc } = await supabase.from("documents").insert({
          organization_id: orgId, name: att.name ?? "attachment", type: "attachment",
          content: att.content ?? "", metadata: { source: "email_attachment", parent_document: doc.id },
        }).select("id").single()
        if (attDoc) attachmentIds.push(attDoc.id)
      }
    }

    return NextResponse.json({ success: true, document_id: doc.id, attachment_ids: attachmentIds })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to ingest email"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
