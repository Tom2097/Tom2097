import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  recordUsage,
  getQuotas,
  checkQuota,
  getUsageSummary,
  getDailyUsage,
} from "@/lib/billing/metering"

const handler = withAuth(async (req: NextRequest, { organizationId }) => {
  try {
    const method = req.method

    if (method === "GET") {
      const scope = req.nextUrl.searchParams.get("scope") || "summary"
      const metric = req.nextUrl.searchParams.get("metric") as any || undefined
      const days = parseInt(req.nextUrl.searchParams.get("days") || "30")

      if (scope === "quotas") {
        const quotas = await getQuotas(organizationId)
        return NextResponse.json({ quotas })
      }

      if (scope === "daily" && metric) {
        const daily = await getDailyUsage(organizationId, metric, days)
        return NextResponse.json({ daily })
      }

      const summary = await getUsageSummary(organizationId)
      return NextResponse.json(summary)
    }

    const body = await req.json() as {
      action: "record" | "check"
      metric?: string
      amount?: number
    }

    if (body.action === "check" && body.metric) {
      const result = await checkQuota(organizationId, body.metric as any)
      return NextResponse.json(result)
    }

    if (body.action === "record" && body.metric) {
      await recordUsage(organizationId, body.metric as any, body.amount || 1)
      return NextResponse.json({ recorded: true })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (err) {
    console.error("[billing-usage] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export { handler as POST, handler as GET }
