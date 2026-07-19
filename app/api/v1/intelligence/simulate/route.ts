"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getDashboardMetrics } from "@/lib/analytics/dashboard"
import { generateForecast } from "@/lib/analytics/forecast"

export async function GET() {
  return NextResponse.json({ message: 'Test' })
}

/** Pull a "grows/drops by N%" shape out of a free-text scenario. Defaults to a
 *  20% increase if the text doesn't specify a number -- good enough for a
 *  quick what-if, not a claim of understanding arbitrary scenario text. */
function parseScenario(scenario: string): { percent: number; direction: "up" | "down" } {
  const match = scenario.match(/(\d+(?:\.\d+)?)\s*%/)
  const percent = match ? Number(match[1]) : 20
  const direction: "up" | "down" = /drop|decrease|shrink|fall|reduc|declin|lower|less\b/i.test(scenario)
    ? "down"
    : "up"
  return { percent, direction }
}

/**
 * POST /api/v1/intelligence/simulate - "What-If Simulation" command from the
 * floating command bar. There's no scenario-modeling engine in this
 * codebase, so this drives a real simple simulation off the org's actual
 * analytics: it takes the org's top event over the last 30 days, forecasts
 * it with the statistical forecaster (lib/analytics/forecast.ts, same one
 * behind /api/v1/analytics/forecast), then scales that real baseline
 * forecast by the percentage change parsed out of the scenario text. This
 * is a real (if simple) projection over real data, not canned output --
 * and it says so honestly when there isn't enough data to project from.
 */
const post = withAuth(async (req: NextRequest, { organizationId }) => {
  let scenario = ""
  try {
    const body = await req.json()
    scenario = typeof body?.scenario === "string" ? body.scenario : ""
  } catch {
    // no/invalid body
  }
  if (!scenario.trim()) {
    return NextResponse.json({ error: "scenario is required" }, { status: 400 })
  }

  const { percent, direction } = parseScenario(scenario)
  const multiplier = 1 + (direction === "up" ? percent : -percent) / 100

  const end = new Date()
  const start = new Date(end.getTime() - 30 * 86400000)

  const metrics = await getDashboardMetrics(organizationId, "30d")
  const topEvent = metrics.topEvents[0]?.event_name

  if (!topEvent) {
    return NextResponse.json({
      scenario,
      ranScenario: false,
      summary: "Not enough activity recorded in this workspace yet to run a projection.",
    })
  }

  try {
    const forecast = await generateForecast(
      organizationId,
      topEvent,
      { start: start.toISOString(), end: end.toISOString() },
      { periods: 6, useAI: false },
    )

    const projection = forecast.forecast.map((p) => ({
      bucket: p.bucket,
      baseline: p.value,
      projected: Math.round(p.value * multiplier * 100) / 100,
    }))

    const changePercent = direction === "up" ? percent : -percent
    return NextResponse.json({
      scenario,
      ranScenario: true,
      metric: topEvent,
      changePercent,
      baselineTrend: forecast.trend,
      projection,
      summary: `If "${topEvent}" ${direction === "up" ? "grows" : "drops"} by ${percent}%, the projected trend over the next ${projection.length} periods scales from a ${forecast.trend} baseline.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run simulation"
    return NextResponse.json({
      scenario,
      ranScenario: false,
      summary: message.includes("Not enough data")
        ? `Not enough historical data for "${topEvent}" to run a projection.`
        : "Failed to run simulation.",
    })
  }
})

export { post as POST }
