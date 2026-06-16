import { createServiceClient } from "@/lib/supabase/service"

/**
 * Webhook idempotency guard (blocker D).
 *
 * Claims an inbound webhook delivery against the `webhook_events` ledger using
 * its provider-supplied event id. Returns:
 *   - `true`  → first time we have seen this event; the caller SHOULD process it.
 *   - `false` → already recorded (duplicate retry / duplicate endpoint); the
 *               caller SHOULD skip processing so no action runs twice.
 *
 * The ledger has a unique (provider, event_id) constraint, so the claim is
 * atomic across concurrent deliveries — the second insert loses with a 23505
 * unique violation and is treated as a duplicate.
 *
 * If no event id is available we cannot dedupe, so we fail OPEN (process) to
 * preserve at-least-once delivery — better to risk a rare duplicate than to
 * silently drop a billing event.
 */
export async function claimWebhookEvent(
  provider: string,
  eventId: string | null | undefined,
  eventType?: string,
): Promise<boolean> {
  if (!eventId) return true

  const db = createServiceClient()
  const { error } = await db
    .from("webhook_events")
    .insert({ provider, event_id: eventId, event_type: eventType ?? null })

  if (!error) return true

  // 23505 = unique_violation → this delivery was already claimed.
  if ((error as { code?: string }).code === "23505") return false

  // Unexpected ledger error: log and fail open so we don't drop the event.
  console.error("[v0] claimWebhookEvent ledger error:", error.message)
  return true
}
