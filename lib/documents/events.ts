import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import { triggerWorkflowsFromDocumentEvent } from "@/lib/workflows/trigger-from-event"

export type DocumentEventType =
  | "document.created"
  | "document.uploaded"
  | "document.classified"
  | "document.extracted"
  | "document.routed"
  | "document.triggered"
  | "document.legal_hold_placed"
  | "document.legal_hold_released"
  | "document.signature_requested"
  | "document.signature_completed"
  | "document.archived"
  | "document.deleted"

export interface DocumentEvent {
  type: DocumentEventType
  organization_id: string
  document_id: string
  actor_id: string | null
  metadata?: Record<string, unknown>
}

const EVENT_TABLE = "document_events"

export async function dispatchDocumentEvent(event: DocumentEvent): Promise<void> {
  try {
    const db = createServiceClient()
    await db.from(EVENT_TABLE).insert({
      organization_id: event.organization_id,
      document_id: event.document_id,
      event_type: event.type,
      actor_id: event.actor_id ?? null,
      metadata: event.metadata ?? {},
    })

    await logAuthEvent({
      action: event.type.replace("document.", "document_") as any,
      userId: event.actor_id,
      organizationId: event.organization_id,
      resourceType: "document",
      resourceId: event.document_id,
      metadata: event.metadata,
    })

    // Activate any workflows that listen for this event type
    triggerWorkflowsFromDocumentEvent(
      event.organization_id,
      event.type,
      { document_id: event.document_id, ...event.metadata },
      event.actor_id,
    ).catch(() => {})
  } catch (err) {
    console.log("[v0] dispatchDocumentEvent failed:", err)
  }
}

export async function getDocumentEvents(
  organizationId: string,
  documentId: string,
  limit = 50,
): Promise<Array<{ id: string; event_type: string; actor_id: string | null; metadata: Record<string, unknown>; created_at: string }>> {
  const db = createServiceClient()
  const { data } = await db
    .from(EVENT_TABLE)
    .select("id, event_type, actor_id, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as any
}
