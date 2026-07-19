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
 * Missing delivery IDs and ledger failures fail closed. Payment providers
 * retry non-2xx deliveries, while processing without an atomic claim can
 * duplicate subscription mutations, event rows, or discount redemption.
 */
export async function claimWebhookEvent(
  provider: string,
  eventId: string | null | undefined,
  eventType?: string,
): Promise<boolean> {
  if (!eventId) {
    throw new Error(`Missing ${provider} webhook event ID`)
  }

  const db = createServiceClient()
  const { error } = await db
    .from("webhook_events")
    .insert({ provider, event_id: eventId, event_type: eventType ?? null })

  if (!error) return true

  // 23505 = unique_violation → this delivery was already claimed.
  if ((error as { code?: string }).code === "23505") return false

  // An unexpected ledger failure means idempotency cannot be guaranteed.
  // Throw so the webhook returns a non-2xx response and the provider retries.
  console.error("[v0] claimWebhookEvent ledger error:", error.message)
  throw new Error(`Unable to claim ${provider} webhook event`)
}
