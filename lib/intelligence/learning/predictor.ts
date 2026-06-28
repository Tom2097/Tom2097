/**
 * Online predictor — incremental learning algorithms that improve with
 * every data point. No batch training required.
 *
 * These are simple but effective online learning methods:
 * - Exponential smoothing (weights recent observations more)
 * - Bayesian average (combines prior belief with observed data)
 * - Trend detection (accelerates/slows predictions based on direction)
 * - Seasonal adjustment (captures weekly/monthly cycles)
 */

import { createServiceClient } from "@/lib/supabase/service"

const MODELS_TABLE = "intelligence_online_models"

export interface OnlineModel {
  id: string
  organizationId: string
  metric: string
  modelType: "exponential_smoothing" | "bayesian_average" | "trend" | "seasonal"
  parameters: Record<string, number>
  observations: number
  lastValue: number
  lastUpdated: Date
}

export interface Prediction {
  metric: string
  predictedValue: number
  confidence: number
  lowerBound: number
  upperBound: number
  factors: Array<{ name: string; weight: number }>
}

// Alpha: smoothing factor (0-1). Higher = more weight on recent data.
const DEFAULT_ALPHA = 0.3
// Beta: trend smoothing factor.
const DEFAULT_BETA = 0.1
// Gamma: seasonal smoothing factor.
const DEFAULT_GAMMA = 0.1
// Season period (e.g., 7 for weekly, 30 for monthly).
const DEFAULT_SEASON_PERIOD = 7

export async function observe(
  organizationId: string,
  metric: string,
  value: number,
  timestamp?: Date,
): Promise<void> {
  const db = createServiceClient()
  const now = timestamp || new Date()

  await upsertModel(db, organizationId, metric, "exponential_smoothing", value, now)
  await upsertModel(db, organizationId, metric, "bayesian_average", value, now)
  await upsertModel(db, organizationId, metric, "trend", value, now)
  await upsertModel(db, organizationId, metric, "seasonal", value, now)
}

export async function predict(
  organizationId: string,
  metric: string,
  horizon: number = 1,
): Promise<Prediction | null> {
  const db = createServiceClient()
  const { data: models } = await db
    .from(MODELS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("metric", metric)

  if (!models || models.length === 0) return null

  const modelMap = new Map<string, OnlineModel>()
  for (const m of models as Array<Record<string, unknown>>) {
    const model: OnlineModel = {
      id: m.id as string,
      organizationId: m.organization_id as string,
      metric: m.metric as string,
      modelType: m.model_type as OnlineModel["modelType"],
      parameters: m.parameters as Record<string, number>,
      observations: m.observations as number,
      lastValue: m.last_value as number,
      lastUpdated: new Date(m.last_updated as string),
    }
    modelMap.set(model.modelType, model)
  }

  let predictedValue = 0
  let totalWeight = 0
  const factors: Array<{ name: string; weight: number }> = []

  const smooth = modelMap.get("exponential_smoothing")
  if (smooth && smooth.observations > 0) {
    const alpha = smooth.parameters.alpha || DEFAULT_ALPHA
    const level = smooth.lastValue
    predictedValue += level * 0.4
    totalWeight += 0.4
    factors.push({ name: "exponential_smoothing", weight: 0.4 })
  }

  const bayes = modelMap.get("bayesian_average")
  if (bayes && bayes.observations > 0) {
    const prior = bayes.parameters.prior_mean || 0
    const k = bayes.parameters.k || 10
    const n = bayes.observations
    const posterior = (prior * k + bayes.lastValue * n) / (k + n)
    predictedValue += posterior * 0.25
    totalWeight += 0.25
    factors.push({ name: "bayesian_average", weight: 0.25 })
  }

  const trend = modelMap.get("trend")
  if (trend && trend.observations > 1) {
    const slope = trend.parameters.slope || 0
    const trendContribution = slope * horizon
    predictedValue += trendContribution * 0.2
    totalWeight += 0.2
    factors.push({ name: "trend", weight: 0.2 })
  }

  const seasonal = modelMap.get("seasonal")
  if (seasonal && seasonal.observations > DEFAULT_SEASON_PERIOD) {
    const s = seasonal.parameters
    const period = s.period || DEFAULT_SEASON_PERIOD
    const seasonalFactor = s[`s_${horizon % period}`] || 0
    predictedValue += seasonalFactor * 0.15
    totalWeight += 0.15
    factors.push({ name: "seasonal", weight: 0.15 })
  }

  if (totalWeight === 0) return null

  predictedValue = predictedValue / totalWeight

  const observationCount = Math.max(
    ...Array.from(modelMap.values()).map((m) => m.observations),
    1,
  )
  const confidence = Math.min(0.95, 0.3 + observationCount * 0.02)
  const spread = predictedValue * (1 - confidence) * 0.5
  const lowerBound = Math.round((predictedValue - spread) * 100) / 100
  const upperBound = Math.round((predictedValue + spread) * 100) / 100

  return {
    metric,
    predictedValue: Math.round(predictedValue * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    lowerBound,
    upperBound,
    factors,
  }
}

async function upsertModel(
  db: ReturnType<typeof createServiceClient>,
  organizationId: string,
  metric: string,
  modelType: OnlineModel["modelType"],
  value: number,
  timestamp: Date,
): Promise<void> {
  const { data: existing } = await db
    .from(MODELS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("metric", metric)
    .eq("model_type", modelType)
    .maybeSingle()

  if (existing) {
    const obs = (existing.observations as number) + 1
    const params = computeParameters(modelType, existing.parameters as Record<string, number>, existing.last_value as number, value, obs)
    await db.from(MODELS_TABLE).update({
      observations: obs,
      last_value: value,
      parameters: params,
      last_updated: timestamp.toISOString(),
    }).eq("id", existing.id)
  } else {
    const params = getDefaultParameters(modelType, value)
    await db.from(MODELS_TABLE).insert({
      organization_id: organizationId,
      metric,
      model_type: modelType,
      parameters: params,
      observations: 1,
      last_value: value,
    })
  }
}

function computeParameters(
  modelType: string,
  currentParams: Record<string, number>,
  lastValue: number,
  newValue: number,
  observationCount: number,
): Record<string, number> {
  const params = { ...currentParams }

  switch (modelType) {
    case "exponential_smoothing": {
      const alpha = params.alpha || DEFAULT_ALPHA
      const smoothed = params.smoothed ?? lastValue
      params.smoothed = alpha * newValue + (1 - alpha) * smoothed
      break
    }
    case "bayesian_average": {
      const k = params.k || 10
      const priorMean = params.prior_mean ?? newValue
      const posterior = (priorMean * k + newValue * (observationCount - 1)) / (k + observationCount - 1)
      params.prior_mean = Math.round(posterior * 100) / 100
      params.k = k + 1
      break
    }
    case "trend": {
      const beta = params.beta || DEFAULT_BETA
      const prevSlope = params.slope ?? 0
      const prevLevel = params.level ?? lastValue
      const newLevel = DEFAULT_ALPHA * newValue + (1 - DEFAULT_ALPHA) * (prevLevel + prevSlope)
      const newSlope = beta * (newLevel - prevLevel) + (1 - beta) * prevSlope
      params.level = Math.round(newLevel * 100) / 100
      params.slope = Math.round(newSlope * 100) / 100
      break
    }
    case "seasonal": {
      const gamma = params.gamma || DEFAULT_GAMMA
      const period = params.period || DEFAULT_SEASON_PERIOD
      const seasonIndex = (observationCount - 1) % period
      const prevSeasonal = params[`s_${seasonIndex}`] ?? 0
      params[`s_${seasonIndex}`] = gamma * (newValue - lastValue) + (1 - gamma) * prevSeasonal
      break
    }
  }

  return params
}

function getDefaultParameters(
  modelType: string,
  initialValue: number,
): Record<string, number> {
  switch (modelType) {
    case "exponential_smoothing":
      return { alpha: DEFAULT_ALPHA, smoothed: initialValue }
    case "bayesian_average":
      return { prior_mean: initialValue, k: 10 }
    case "trend":
      return { alpha: DEFAULT_ALPHA, beta: DEFAULT_BETA, level: initialValue, slope: 0 }
    case "seasonal":
      return { gamma: DEFAULT_GAMMA, period: DEFAULT_SEASON_PERIOD }
    default:
      return {}
  }
}
