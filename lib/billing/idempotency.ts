import { createServiceClient } from "@/lib/supabase/service"

const WEBHOOK_LEASE_MS = 5 * 60 * 1000

type WebhookEventState = {
  status: "processing" | "completed" | "failed"
  claimed_at: string | null
  attempts: number | null
}

/**
 * Webhook idempotency guard (blocker D).
 *
 * Claims an inbound webhook delivery against the `webhook_events` ledger using
 * its provider-supplied event id. Returns:
 *   - `true`  → first time we have seen this event; the caller SHOULD process it.
 *   - `false` → already completed; the caller SHOULD skip it.
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
  const claimedAt = new Date().toISOString()
  const { error } = await db
    .from("webhook_events")
    .insert({
      provider,
      event_id: eventId,
      event_type: eventType ?? null,
      status: "processing",
      claimed_at: claimedAt,
      attempts: 1,
    })

  if (!error) return true

  if ((error as { code?: string }).code === "23505") {
    const { data: existing, error: readError } = await db
      .from("webhook_events")
      .select("status, claimed_at, attempts")
      .eq("provider", provider)
      .eq("event_id", eventId)
      .single()

    if (readError || !existing) {
      throw new Error(`Unable to inspect ${provider} webhook event claim`)
    }

    const state = existing as WebhookEventState
    if (state.status === "completed") return false

    const leaseExpired = state.status === "processing" &&
      (!state.claimed_at || Date.now() - new Date(state.claimed_at).getTime() >= WEBHOOK_LEASE_MS)
    if (state.status === "processing" && !leaseExpired) {
      throw new Error(`${provider} webhook event is already processing`)
    }

    let retry = db
      .from("webhook_events")
      .update({
        status: "processing",
        claimed_at: claimedAt,
        completed_at: null,
        last_error: null,
        attempts: (state.attempts ?? 1) + 1,
      })
      .eq("provider", provider)
      .eq("event_id", eventId)
      .eq("status", state.status)

    if (state.claimed_at) retry = retry.eq("claimed_at", state.claimed_at)
    const { data: reclaimed, error: retryError } = await retry.select("id").maybeSingle()
    if (retryError) throw new Error(`Unable to reclaim ${provider} webhook event`)
    if (!reclaimed) throw new Error(`${provider} webhook event is already processing`)
    return true
  }

  // An unexpected ledger failure means idempotency cannot be guaranteed.
  // Throw so the webhook returns a non-2xx response and the provider retries.
  console.error("[v0] claimWebhookEvent ledger error:", error.message)
  throw new Error(`Unable to claim ${provider} webhook event`)
}

export async function completeWebhookEvent(provider: string, eventId: string): Promise<void> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("webhook_events")
    .update({ status: "completed", completed_at: new Date().toISOString(), last_error: null })
    .eq("provider", provider)
    .eq("event_id", eventId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle()

  if (error || !data) throw new Error(`Unable to complete ${provider} webhook event`)
}

export async function failWebhookEvent(provider: string, eventId: string, error: unknown): Promise<void> {
  const db = createServiceClient()
  const message = error instanceof Error ? error.message : String(error)
  const { error: updateError } = await db
    .from("webhook_events")
    .update({ status: "failed", last_error: message.slice(0, 1000) })
    .eq("provider", provider)
    .eq("event_id", eventId)
    .eq("status", "processing")

  if (updateError) console.error("[v0] Failed to release webhook event claim:", updateError.message)
}
