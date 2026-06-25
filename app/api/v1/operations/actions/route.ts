import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { draftResponse, triggerAutoActions } from "@/lib/operational/actions"
import { queueForReview } from "@/lib/operational/hitl"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    const userId = ctx?.userId
    if (!orgId || !userId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { action, documentId, content, classification, context } = await request.json()
    if (!action || !documentId || !content) return NextResponse.json({ error: "action, documentId, and content are required" }, { status: 400 })

    switch (action) {
      case "draft_response": {
        const response = await draftResponse(orgId, documentId, content, context)
        if (!response) return NextResponse.json({ error: "Failed to draft response" }, { status: 500 })
        return NextResponse.json({ success: true, data: { response } })
      }

      case "auto_create": {
        const result = await triggerAutoActions(orgId, documentId, content, classification ?? "general", userId)
        return NextResponse.json({ success: true, data: result })
      }

      case "queue_review": {
        const reviewItem = await queueForReview(
          orgId, documentId, "create_record",
          { action, classification, content_length: content.length },
          65,
        )
        return NextResponse.json({ success: true, data: { review_item: reviewItem, queued: !!reviewItem } })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Action failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
