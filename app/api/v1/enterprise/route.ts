import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/auth/with-auth"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { assertPublicHttpUrl, UnsafeUrlError } from "@/lib/security/url-guard"
import { createWebhookDelivery, deliverWebhook } from "@/lib/webhooks/delivery"
import { calculateCompositeScore, decomposeDrivers, runWhatIfSimulation, benchmarkCohorts } from "@/lib/digit-score/composite"

const webhookSchema = z.object({
  url: z.string().url(),
  event: z.string().min(1).max(200),
  payload: z.unknown(),
  maxRetries: z.number().int().min(1).max(5).optional(),
})

const scoring = withAuth(
  async (req) => {
    try {
      const body = await req.json()
      const { action, ...params } = body

      if (action === "digit-score") {
        return NextResponse.json(calculateCompositeScore())
      }
      if (action === "driver-decomposition") {
        return NextResponse.json(decomposeDrivers(params.targetMetric, params.currentValue, params.targetValue))
      }
      if (action === "what-if") {
        return NextResponse.json(runWhatIfSimulation(params.baseMetrics, params.scenarios))
      }
      if (action === "cohort-benchmark") {
        return NextResponse.json(benchmarkCohorts(params.cohorts, params.industryPercentiles))
      }
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } catch (err) {
      console.error("[enterprise] request failed:", err)
      return NextResponse.json({ error: "Request failed" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)

const webhook = withAuth(
  async (req, context) => {
    const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
    if (rateLimited) return rateLimited

    const parsed = webhookSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid webhook request" }, { status: 400 })
    }

    try {
      const url = await assertPublicHttpUrl(parsed.data.url)
      const delivery = createWebhookDelivery(url.toString(), parsed.data.event, parsed.data.payload, parsed.data.maxRetries)
      return NextResponse.json(await deliverWebhook(delivery))
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        return NextResponse.json({ error: "This URL is not allowed" }, { status: 400 })
      }
      console.error("[enterprise] webhook delivery failed:", err)
      return NextResponse.json({ error: "Webhook delivery failed" }, { status: 500 })
    }
  },
  { requireAll: ["integrations:write"] },
)

// Sending a webhook is a higher privilege than reading scores, so the action
// selects which permission applies. Each handler re-reads the body and enforces
// its own auth, so nothing from this peek is trusted.
export async function POST(req: NextRequest) {
  const body = await req.clone().json().catch(() => null)
  return body?.action === "webhook" ? webhook(req) : scoring(req)
}
