import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { getCrossTenantBenchmarks, getPeerComparisons, collectMetrics } from "@/lib/intelligence/aggregator"

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const type = req.nextUrl.searchParams.get("type") || "benchmarks"

  if (type === "comparisons") {
    const comparisons = await getPeerComparisons(ctx.organizationId)
    return NextResponse.json({ comparisons })
  }

  const benchmarks = await getCrossTenantBenchmarks(ctx.organizationId)
  return NextResponse.json({ benchmarks })
}

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await collectMetrics(ctx.organizationId)
  return NextResponse.json({ status: "ok" })
}
