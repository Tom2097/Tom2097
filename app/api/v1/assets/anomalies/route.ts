import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractTenantContext } from "@/lib/multitenant/context"
import { detectAnomalies } from "@/lib/analytics/anomaly-detection"

export async function GET(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 403 })
    }

    const url = new URL(request.url)
    const assetId = url.searchParams.get("asset_id")
    const metric = url.searchParams.get("metric") || "value"
    const days = parseInt(url.searchParams.get("days") || "30", 10)

    const db = createServiceClient()
    let query = db
      .from("asset_readings")
      .select("*")
      .eq("organization_id", orgId)
      .gte("recorded_at", new Date(Date.now() - days * 86400000).toISOString())
      .order("recorded_at", { ascending: true })

    if (assetId) query = query.eq("asset_id", assetId)

    const { data: readings, error } = await query
    if (error) {
      return NextResponse.json({ error: "Failed to fetch asset readings" }, { status: 500 })
    }

    if (!readings || readings.length < 10) {
      return NextResponse.json({ anomalies: [], message: "Not enough data points (min 10)" })
    }

    const now = new Date()
    const start = new Date(now.getTime() - days * 86400000).toISOString()

    const anomalies = await detectAnomalies(orgId, metric, {
      start,
      end: now.toISOString(),
    }, {
      methods: ["zscore", "iqr", "rolling_avg"],
      sensitivity: 2.5,
    })

    return NextResponse.json({
      anomalies,
      total_readings: readings.length,
      metric,
      period_days: days,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
