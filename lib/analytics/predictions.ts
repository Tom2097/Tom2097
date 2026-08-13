import { createServiceClient } from "@/lib/supabase/service"
import { computeDealHealth } from "@/lib/crm/smart-layer"
import { computeDigitScore } from "@/lib/analytics/digit-score"

export interface RealPrediction {
  id: string
  label: string
  value: string
  confidence: number // 0-100. For trend projections, derived from real
  // historical variance (tight variance -> high confidence), never invented.
  // For direct counts (deals at risk, health score), always 100 -- these
  // are not probabilistic forecasts, they're a plain count/score of real
  // current data, and calling that "85% confident" would be dishonest.
  trend: "up" | "down" | "flat"
  basis: string
  insufficientData?: boolean
}

const MIN_MONTHS_FOR_TREND = 3

/** Ordinary-least-squares linear regression over an evenly-spaced series --
 *  same technique lib/analytics/forecasting.ts's forecastMetric() and
 *  driverDecomposition() already use, applied here to real closed-won deal
 *  data instead of the analytics_events pipeline (which has no write path
 *  anywhere in this codebase -- lib/dashboard/queries.ts's getRevenueMetrics
 *  reads analytics_metrics, a table nothing ever inserts into, so it's
 *  always empty in production; not a usable data source). */
function linearTrend(points: number[]): { slope: number; intercept: number } {
  const n = points.length
  const mean = points.reduce((a, b) => a + b, 0) / n
  const xMean = (n - 1) / 2
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (points[i] - mean)
    denominator += (i - xMean) ** 2
  }
  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = mean - slope * xMean
  return { slope, intercept }
}

/** Confidence derived from coefficient of variation (std/mean) of the real
 *  historical series -- a tight, consistent trend earns high confidence, a
 *  noisy one earns low. Clamped to [30, 95]; never 100 (a trend projection
 *  is never certain) and never fabricated independent of the actual data. */
function trendConfidence(points: number[]): number {
  const mean = points.reduce((a, b) => a + b, 0) / points.length
  if (mean <= 0) return 30
  const std = Math.sqrt(points.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / points.length)
  return Math.max(30, Math.min(95, Math.round(100 - (std / mean) * 100)))
}

interface MonthBucket {
  monthKey: string
  count: number
  value: number
}

async function monthlyWonDeals(organizationId: string, months: number): Promise<MonthBucket[]> {
  const db = createServiceClient()
  const start = new Date()
  start.setMonth(start.getMonth() - months)

  const { data } = await db
    .from("crm_deals")
    .select("value, closed_at")
    .eq("organization_id", organizationId)
    .eq("stage", "won")
    .gte("closed_at", start.toISOString())

  const buckets = new Map<string, { count: number; value: number }>()
  for (const row of data ?? []) {
    if (!row.closed_at) continue
    const d = new Date(row.closed_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const b = buckets.get(key) ?? { count: 0, value: 0 }
    b.count++
    b.value += row.value ?? 0
    buckets.set(key, b)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, v]) => ({ monthKey, ...v }))
}

/**
 * Real predictions for the Intelligence Hub's Predictions tab -- replaces
 * the previous hardcoded "Example Forecasts" array (see
 * components/digit/industry-intelligence-hub.tsx's own comment on why that
 * was honestly relabeled illustrative rather than left claiming to be live
 * AI output with no real pipeline behind it).
 *
 * Each entry is traceable to a real, queryable data source (stated in
 * `basis`); when there isn't enough real history to project from, that's
 * reported honestly via `insufficientData` rather than filled with a
 * plausible-looking placeholder number.
 */
export async function getRealPredictions(organizationId: string): Promise<RealPrediction[]> {
  const predictions: RealPrediction[] = []
  const series = await monthlyWonDeals(organizationId, 6)

  // 1. Revenue trend, from real closed-won deal value history.
  if (series.length >= MIN_MONTHS_FOR_TREND) {
    const values = series.map((s) => s.value)
    const { slope, intercept } = linearTrend(values)
    const n = values.length
    const nextMonthProjection = Math.max(0, intercept + slope * n)
    const lastMonth = values[n - 1]
    const pctChange = lastMonth > 0 ? ((nextMonthProjection - lastMonth) / lastMonth) * 100 : 0
    predictions.push({
      id: "revenue_trend",
      label: "Next Month Revenue Trend",
      value: `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%`,
      confidence: trendConfidence(values),
      trend: pctChange >= 0 ? "up" : "down",
      basis: `Linear trend over ${n} months of real closed-won deal value`,
    })
  } else {
    predictions.push({
      id: "revenue_trend",
      label: "Revenue Trend",
      value: "Not enough data yet",
      confidence: 0,
      trend: "flat",
      basis: `Needs at least ${MIN_MONTHS_FOR_TREND} months of closed-won deals (have ${series.length})`,
      insufficientData: true,
    })
  }

  // 2. Customer acquisition, next 90 days -- projected won-deal COUNT.
  if (series.length >= MIN_MONTHS_FOR_TREND) {
    const counts = series.map((s) => s.count)
    const { slope, intercept } = linearTrend(counts)
    const n = counts.length
    let projected90 = 0
    for (let i = 1; i <= 3; i++) projected90 += Math.max(0, intercept + slope * (n - 1 + i))
    predictions.push({
      id: "acquisition_trend",
      label: "New Customers, Next 90 Days",
      value: `~${Math.round(projected90)}`,
      confidence: trendConfidence(counts),
      trend: slope >= 0 ? "up" : "down",
      basis: `Linear trend over ${n} months of real closed-won deal count`,
    })
  } else {
    predictions.push({
      id: "acquisition_trend",
      label: "New Customers, Next 90 Days",
      value: "Not enough data yet",
      confidence: 0,
      trend: "flat",
      basis: `Needs at least ${MIN_MONTHS_FOR_TREND} months of closed-won deals (have ${series.length})`,
      insufficientData: true,
    })
  }

  // 3. Deals at risk -- a direct count of real deals flagged by
  // computeDealHealth (stalled 21+ days), not a probabilistic forecast.
  const dealHealth = await computeDealHealth(organizationId)
  const highRisk = dealHealth.filter((d) => d.risk === "high")
  predictions.push({
    id: "deals_at_risk",
    label: "Deals At Risk (High Priority)",
    value: `${highRisk.length} deal${highRisk.length === 1 ? "" : "s"}`,
    confidence: 100,
    trend: highRisk.length > 0 ? "down" : "up",
    basis: "Open deals stalled 21+ days with no logged activity",
  })

  // 4. Operational health score -- real (compliance + resource utilization
  // + performance), NOT a market-opportunity metric. No real external
  // market-sizing/TAM data exists anywhere in this codebase, so rather
  // than fabricate one, this reports the real composite score that does
  // exist under its own honest name.
  const score = await computeDigitScore(organizationId)
  predictions.push({
    id: "operational_health",
    label: "Operational Health Score",
    value: `${(score.overall / 10).toFixed(1)}/10`,
    confidence: 100,
    trend: score.overall >= 70 ? "up" : "down",
    basis: "Compliance + resource utilization + performance, weighted",
  })

  return predictions
}
