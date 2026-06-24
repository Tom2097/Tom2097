import { createHash, randomBytes } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"

export interface WebhookEndpoint {
  id: string
  organization_id: string
  name: string
  url: string
  secret: string
  events: string[]
  enabled: boolean
  retry_count: number
  created_at: string
}

export interface WebhookDelivery {
  id: string
  endpoint_id: string
  event_type: string
  payload: unknown
  status: "pending" | "delivered" | "failed" | "dead"
  attempt: number
  status_code: number | null
  error: string | null
  next_retry_at: string | null
  created_at: string
}

const MAX_RETRIES = 5
const RETRY_BACKOFFS = [60, 300, 900, 3600, 14400]

export async function createEndpoint(
  organizationId: string,
  input: { name: string; url: string; events: string[] },
): Promise<WebhookEndpoint | null> {
  const db = createServiceClient()
  const secret = randomBytes(24).toString("hex")
  const { data, error } = await db
    .from("webhook_endpoints")
    .insert({ organization_id: organizationId, ...input, secret, enabled: true })
    .select("*")
    .single()
  if (error) return null
  return data as WebhookEndpoint
}

export async function deliverWebhook(
  endpoint: WebhookEndpoint,
  eventType: string,
  payload: unknown,
  idempotencyKey: string,
): Promise<void> {
  const db = createServiceClient()
  const body = JSON.stringify({ event: eventType, idempotency_key: idempotencyKey, data: payload, timestamp: new Date().toISOString() })
  const signature = createHash("sha256").update(body + endpoint.secret).digest("hex")

  let attempt = 0
  let lastError: string | null = null
  let lastStatus: number | null = null

  while (attempt <= MAX_RETRIES) {
    attempt++
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature, "X-Idempotency-Key": idempotencyKey },
        body,
        signal: AbortSignal.timeout(30000),
      })
      lastStatus = res.status
      if (res.ok) {
        await db.from("webhook_deliveries").insert({
          endpoint_id: endpoint.id, event_type: eventType, payload, status: "delivered", attempt, status_code: res.status,
          idempotency_key: idempotencyKey,
        })
        return
      }
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = (err as Error).message
    }

    if (attempt <= MAX_RETRIES) {
      const backoff = RETRY_BACKOFFS[attempt - 1] ?? 14400
      const nextRetry = new Date(Date.now() + backoff * 1000).toISOString()
      await db.from("webhook_deliveries").insert({
        endpoint_id: endpoint.id, event_type: eventType, payload, status: "pending", attempt,
        status_code: lastStatus, error: lastError, next_retry_at: nextRetry, idempotency_key: idempotencyKey,
      })
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  await db.from("webhook_deliveries").insert({
    endpoint_id: endpoint.id, event_type: eventType, payload, status: "dead", attempt,
    status_code: lastStatus, error: lastError, idempotency_key: idempotencyKey,
  })
}

export async function listEndpoints(organizationId: string): Promise<WebhookEndpoint[]> {
  const db = createServiceClient()
  const { data } = await db.from("webhook_endpoints").select("*").eq("organization_id", organizationId)
  return (data ?? []) as WebhookEndpoint[]
}
