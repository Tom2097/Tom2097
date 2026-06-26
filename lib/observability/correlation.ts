import { randomBytes } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"

export function generateCorrelationId(): string {
  return `dig_${Date.now().toString(36)}_${randomBytes(8).toString("hex")}`
}

export async function logCorrelatedEvent(
  correlationId: string,
  organizationId: string,
  source: string,
  event: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = createServiceClient()
    await db.from("correlated_events").insert({
      correlation_id: correlationId,
      organization_id: organizationId,
      source,
      event,
      metadata,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.log("[v0] logCorrelatedEvent failed:", err)
  }
}

export async function getCorrelatedEvents(correlationId: string): Promise<Array<{
  source: string; event: string; metadata: Record<string, unknown>; created_at: string
}>> {
  const db = createServiceClient()
  const { data } = await db
    .from("correlated_events")
    .select("source, event, metadata, created_at")
    .eq("correlation_id", correlationId)
    .order("created_at", { ascending: true })
  return (data ?? []) as Array<{ source: string; event: string; metadata: Record<string, unknown>; created_at: string }>
}
