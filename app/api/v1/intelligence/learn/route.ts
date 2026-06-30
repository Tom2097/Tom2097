import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { runLearningCycle, backfillFeedback } from "@/lib/intelligence/learning/pipeline"
import { seedSyntheticData } from "@/lib/intelligence/learning/synthetic"
import { predict } from "@/lib/intelligence/learning/predictor"
import { getCalibration } from "@/lib/intelligence/learning/feedback"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rateLimited = await checkTenantRateLimit(ctx.organizationId, 60, 10)
  if (rateLimited) return rateLimited

  const body = await req.json().catch(() => null)

  if (body?.action === "cycle") {
    const result = await runLearningCycle(ctx.organizationId)
    return NextResponse.json(result)
  }

  if (body?.action === "seed") {
    const result = await seedSyntheticData(ctx.organizationId)
    return NextResponse.json(result)
  }

  if (body?.action === "backfill") {
    const count = await backfillFeedback(ctx.organizationId)
    return NextResponse.json({ backfilled: count })
  }

  const result = await runLearningCycle(ctx.organizationId)
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const metric = req.nextUrl.searchParams.get("metric")
  const horizon = parseInt(req.nextUrl.searchParams.get("horizon") || "7", 10)

  if (metric) {
    const prediction = await predict(ctx.organizationId, metric, horizon)
    return NextResponse.json({ prediction })
  }

  const calibrations = await getCalibration(ctx.organizationId)
  return NextResponse.json({ calibrations })
}
