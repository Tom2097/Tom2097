import { listWorkflowsForEvent } from "./store"
import { triggerWorkflow } from "./trigger"
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
    try {
      const result = await triggerWorkflow(wf, "event", input, startedBy)
      if (result) triggered++
    } catch (err) {
      console.error(`[workflows] event-triggered run failed for ${wf.id}:`, err)
    }
  }

  return triggered
}
