import { createServiceClient } from "@/lib/supabase/service"
import { listWorkflowsForEvent, createExecution } from "./store"
import type { DocumentEventType } from "@/lib/documents/events"

/**
 * When a document event fires, find and activate matching workflows.
 * This bridges document events → workflow executions.
 */
export async function triggerWorkflowsFromDocumentEvent(
  organizationId: string,
  eventType: DocumentEventType,
  input: Record<string, unknown>,
  startedBy: string | null,
): Promise<number> {
  const workflows = await listWorkflowsForEvent(organizationId, eventType)
  let triggered = 0

  for (const wf of workflows) {
    const result = await createExecution(organizationId, wf.id, "event", input, startedBy)
    if (result) triggered++
  }

  return triggered
}
