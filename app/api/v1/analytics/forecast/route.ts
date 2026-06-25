import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { forecastTimeSeries, detectSeasonality } from "@/lib/analytics/forecasting-extended"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    if (!ctx) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { historicalData, periods, method } = await request.json()
    if (!historicalData || !Array.isArray(historicalData) || historicalData.length < 2) {
      return NextResponse.json({ error: "historicalData array with at least 2 points is required" }, { status: 400 })
    }

    const numPeriods = periods ?? 6
    const forecastMethod = method ?? "linear"

    const [forecast, seasonality] = await Promise.all([
      forecastTimeSeries(historicalData, numPeriods, forecastMethod),
      detectSeasonality(historicalData),
    ])

    return NextResponse.json({
      success: true,
      data: { ...forecast, seasonality_detected: seasonality },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Forecast failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
