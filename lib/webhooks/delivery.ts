import { createHmac } from "crypto"

interface WebhookDelivery { id: string; url: string; event: string; payload: unknown; status: "pending" | "success" | "failed"; attempt: number; maxRetries: number; lastAttempt?: Date; createdAt: Date }

export function createWebhookDelivery(url: string, event: string, payload: unknown, maxRetries = 3): WebhookDelivery {
  return { id: `wh-${crypto.randomUUID()}`, url, event, payload, status: "pending", attempt: 0, maxRetries, createdAt: new Date() }
}

function signPayload(secret: string, payload: unknown): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex")
}

export async function deliverWebhook(delivery: WebhookDelivery, secret?: string): Promise<WebhookDelivery> {
  let current = { ...delivery }
  while (current.attempt < current.maxRetries) {
    current = { ...current, attempt: current.attempt + 1, lastAttempt: new Date() }
    const signature = secret ? signPayload(secret, current.payload) : ""
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Id": current.id,
      "X-Event-Type": current.event,
      "X-Idempotency-Key": current.id,
    }
    if (signature) headers["X-Signature-256"] = signature
    try {
      const response = await fetch(current.url, {
        method: "POST",
        headers,
        body: JSON.stringify(current.payload),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { ...current, status: "success" }
    } catch {
      clearTimeout(timeout)
      if (current.attempt >= current.maxRetries) {
        return { ...current, status: "failed" }
      }
      const delay = Math.pow(2, current.attempt) * 1000
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return { ...current, status: "failed" }
}