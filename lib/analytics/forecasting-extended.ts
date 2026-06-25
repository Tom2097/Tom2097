import { generateText } from "ai"
import { FAST_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"

export interface ForecastResult {
  periods: Array<{
    date: string
    predicted: number
    lower_bound: number
    upper_bound: number
  }>
  trend: "up" | "down" | "stable"
  confidence: number
  seasonality: string | null
  r2_score: number
  method: string
}

export async function forecastTimeSeries(
  historicalData: Array<{ date: string; value: number }>,
  periods: number = 6,
  method: "arima" | "prophet" | "linear" = "linear",
): Promise<ForecastResult> {
  const dataPoints = historicalData.slice(-90)
  const values = dataPoints.map((d) => d.value)
  const dates = dataPoints.map((d) => d.date)

  if (values.length < 4) {
    return {
      periods: Array.from({ length: periods }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000).toISOString().split("T")[0],
        predicted: values[values.length - 1] ?? 0,
        lower_bound: 0,
        upper_bound: 0,
      })),
      trend: "stable", confidence: 30, seasonality: null, r2_score: 0, method: "fallback",
    }
  }

  if (method === "linear") {
    return linearForecast(dataPoints, periods)
  }

  return aiForecast(values, dates, periods, method)
}

function linearForecast(
  data: Array<{ date: string; value: number }>,
  periods: number,
): ForecastResult {
  const n = data.length
  const xMean = (n - 1) / 2
  const yMean = data.reduce((s, d) => s + d.value, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const x = i - xMean
    const y = data[i].value - yMean
    num += x * y
    den += x * x
  }

  const slope = den !== 0 ? num / den : 0
  const intercept = yMean - slope * xMean

  const residuals = data.map((d, i) => Math.pow(d.value - (slope * i + intercept), 2))
  const ssRes = residuals.reduce((s, r) => s + r, 0)
  const ssTot = data.reduce((s, d) => s + Math.pow(d.value - yMean, 2), 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  const trend: "up" | "down" | "stable" = Math.abs(slope) < 0.01 ? "stable" : slope > 0 ? "up" : "down"

  const lastDate = new Date(data[data.length - 1].date)
  const std = Math.sqrt(ssRes / n)

  const periods_result = Array.from({ length: periods }, (_, i) => {
    const idx = n + i
    const predicted = slope * idx + intercept
    const date = new Date(lastDate)
    date.setDate(date.getDate() + (i + 1) * (n > 1 ? Math.round((new Date(data[1].date).getTime() - new Date(data[0].date).getTime()) / 86400000) : 1))
    return {
      date: date.toISOString().split("T")[0],
      predicted: Math.max(0, Math.round(predicted * 100) / 100),
      lower_bound: Math.max(0, Math.round((predicted - 1.96 * std) * 100) / 100),
      upper_bound: Math.max(0, Math.round((predicted + 1.96 * std) * 100) / 100),
    }
  })

  return {
    periods: periods_result,
    trend,
    confidence: Math.min(95, Math.round(r2 * 100)),
    seasonality: null,
    r2_score: Math.round(r2 * 100) / 100,
    method: "linear_regression",
  }
}

async function aiForecast(
  values: number[],
  dates: string[],
  periods: number,
  method: string,
): Promise<ForecastResult> {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a time-series forecasting engine. Given historical data points, forecast future values.
Return ONLY a JSON object:
{
  "forecast": [{ "date": "YYYY-MM-DD", "predicted": number, "lower_bound": number, "upper_bound": number }],
  "trend": "up" | "down" | "stable",
  "confidence": number (0-100),
  "seasonality": string | null,
  "r2_score": number (0-1)
}
Use ${method} methodology. Provide realistic confidence intervals. Values should be non-negative.`

  const dataStr = values.map((v, i) => `${dates[i]}: ${v}`).join("\n")

  try {
    const result = await generateText({
      model: FAST_MODEL,
      system: systemPrompt,
      prompt: `Historical data (${values.length} points):\n"""\n${dataStr}\n"""\n\nForecast next ${periods} periods using ${method}:`,
      temperature: 0.2,
      maxOutputTokens: 1500,
    })

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Failed to parse")

    const parsed = JSON.parse(jsonMatch[0])
    return {
      periods: parsed.forecast ?? [],
      trend: parsed.trend ?? "stable",
      confidence: parsed.confidence ?? 70,
      seasonality: parsed.seasonality ?? null,
      r2_score: parsed.r2_score ?? 0,
      method,
    }
  } catch {
    return linearForecast(
      values.map((v, i) => ({ date: dates[i], value: v })),
      periods,
    )
  }
}

export function detectSeasonality(
  data: Array<{ date: string; value: number }>,
): { period: number; strength: number } | null {
  if (data.length < 14) return null

  const values = data.map((d) => d.value)
  const n = values.length

  for (const period of [7, 30, 90]) {
    if (n < period * 2) continue
    let autoCorr = 0
    let variance = 0
    const mean = values.reduce((s, v) => s + v, 0) / n

    for (let i = 0; i < n - period; i++) {
      autoCorr += (values[i] - mean) * (values[i + period] - mean)
      variance += Math.pow(values[i] - mean, 2)
    }

    const strength = variance > 0 ? Math.abs(autoCorr) / variance : 0
    if (strength > 0.3) return { period, strength }
  }

  return null
}
