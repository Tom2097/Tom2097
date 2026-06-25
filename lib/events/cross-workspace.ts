import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export type CrossWorkspaceEventType =
  | "workspace.document_routed"
  | "workspace.anomaly_shared"
  | "workspace.forecast_shared"
  | "workspace.alert_broadcast"
  | "workspace.report_generated"

export interface CrossWorkspaceEvent {
  type: CrossWorkspaceEventType
  source_workspace: string
  target_workspaces: string[]
  organization_id: string
  payload: Record<string, unknown>
  correlation_id: string
}

export interface CorrelationContext {
  correlation_id: string
  source: string
  timestamp: Date
  chain: Array<{ event: string; workspace: string; timestamp: Date }>
}

export function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function emitCrossWorkspaceEvent(
  event: CrossWorkspaceEvent,
): Promise<boolean> {
  try {
    const db = createServiceClient()

    await db.from("workspace_events").insert({
      organization_id: event.organization_id,
      event_type: event.type,
      source_workspace: event.source_workspace,
      target_workspaces: event.target_workspaces,
      payload: event.payload,
      correlation_id: event.correlation_id,
    })

    for (const target of event.target_workspaces) {
      await publish({
        type: event.type as any,
        organization_id: event.organization_id,
        data: event.payload as any,
      })
    }

    return true
  } catch {
    return false
  }
}

export async function getCorrelationChain(
  correlationId: string,
  organizationId: string,
): Promise<CorrelationContext | null> {
  const db = createServiceClient()
  const { data: events } = await db.from("workspace_events")
    .select("*")
    .eq("correlation_id", correlationId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })

  if (!events || events.length === 0) return null

  return {
    correlation_id: correlationId,
    source: (events[0] as any).source_workspace,
    timestamp: new Date((events[0] as any).created_at),
    chain: (events as any[]).map((e) => ({
      event: e.event_type,
      workspace: e.source_workspace,
      timestamp: new Date(e.created_at),
    })),
  }
}

export async function routeDocumentToWorkspace(
  organizationId: string,
  documentId: string,
  sourceWorkspace: string,
  targetWorkspace: string,
  reason: string,
): Promise<boolean> {
  const db = createServiceClient()
  const correlationId = createCorrelationId()

  await db.from("documents").update({
    metadata: { routed_to: targetWorkspace, routed_from: sourceWorkspace, routed_at: new Date().toISOString(), reason },
  }).eq("id", documentId)

  return emitCrossWorkspaceEvent({
    type: "workspace.document_routed",
    source_workspace: sourceWorkspace,
    target_workspaces: [targetWorkspace],
    organization_id: organizationId,
    payload: { document_id: documentId, reason },
    correlation_id: correlationId,
  })
}

export async function listWorkspaceEvents(
  organizationId: string,
  workspace?: string,
  limit: number = 50,
): Promise<CrossWorkspaceEvent[]> {
  const db = createServiceClient()
  let query = db.from("workspace_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (workspace) {
    query = query.eq("source_workspace", workspace)
  }

  const { data } = await query
  return (data ?? []) as CrossWorkspaceEvent[]
}
