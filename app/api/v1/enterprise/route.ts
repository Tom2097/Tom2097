import { NextRequest, NextResponse } from "next/server"
import { createWebhookDelivery, deliverWebhook } from "@/lib/webhooks/delivery"
import { calculateCompositeScore, decomposeDrivers, runWhatIfSimulation, benchmarkCohorts } from "@/lib/digit-score/composite"

export async function POST(req: NextRequest) {
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
    if (action === "webhook") {
      const delivery = createWebhookDelivery(params.url, params.event, params.payload, params.maxRetries)
      const result = await deliverWebhook(delivery)
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
