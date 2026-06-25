interface WebhookDelivery { id: string; url: string; event: string; payload: unknown; status: "pending" | "success" | "failed"; attempt: number; maxRetries: number; lastAttempt?: Date; createdAt: Date }

export function createWebhookDelivery(url: string, event: string, payload: unknown, maxRetries = 3): WebhookDelivery {
  return { id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, url, event, payload, status: "pending", attempt: 0, maxRetries, createdAt: new Date() }
}

export async function deliverWebhook(delivery: WebhookDelivery): Promise<WebhookDelivery> {
  const deliveryWithAttempt = { ...delivery, attempt: delivery.attempt + 1, lastAttempt: new Date() }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(delivery.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Id": delivery.id, "X-Event-Type": delivery.event, "X-Idempotency-Key": delivery.id },
      body: JSON.stringify(delivery.payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return { ...deliveryWithAttempt, status: "success" }
  } catch {
    if (deliveryWithAttempt.attempt >= delivery.maxRetries) {
      return { ...deliveryWithAttempt, status: "failed" }
    }
    const delay = Math.pow(2, deliveryWithAttempt.attempt) * 1000
    await new Promise((r) => setTimeout(r, delay))
    return deliverWebhook(deliveryWithAttempt)
  }
}

export async function processWebhookWithDLQ(delivery: WebhookDelivery, dlqBuffer: WebhookDelivery[]): Promise<WebhookDelivery> {
  const result = await deliverWebhook(delivery)
  if (result.status === "failed") {
    dlqBuffer.push(result)
  }
  return result
}
