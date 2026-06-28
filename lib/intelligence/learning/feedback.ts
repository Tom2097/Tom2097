/**
 * Feedback tracker — records prediction/action outcomes and adjusts
 * confidence scores based on historical accuracy.
 *
 * This is the core of the learning loop: every prediction made and
 * every action taken gets scored on outcome. Over time, the system
 * learns which signal patterns lead to correct outcomes and adjusts
 * its confidence calibration accordingly.
 */

import { createServiceClient } from "@/lib/supabase/service"

const FEEDBACK_TABLE = "intelligence_feedback"
const CONFIDENCE_CALIBRATION_TABLE = "intelligence_confidence_calibration"

export interface PredictionOutcome {
  predictionId: string
  organizationId: string
  metric: string
  predictedValue: number
  actualValue: number
  error: number
  absoluteErrorPercent: number
  wasCorrect: boolean
  occurredAt: Date
}

export interface ActionOutcome {
  actionId: string
  organizationId: string
  actionType: string
  module: string
  wasSuccessful: boolean
  timeToComplete: number
  notes?: string
}

export interface ConfidenceCalibration {
  metric: string
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  averageConfidence: number
  calibrationError: number
  lastUpdated: Date
}

export async function recordPredictionOutcome(
  predictionId: string,
  organizationId: string,
  metric: string,
  predictedValue: number,
  actualValue: number,
): Promise<PredictionOutcome> {
  const error = predictedValue - actualValue
  const absoluteErrorPercent = actualValue !== 0
    ? Math.abs(error / actualValue) * 100
    : error !== 0 ? 100 : 0
  const wasCorrect = absoluteErrorPercent <= 20

  const outcome: PredictionOutcome = {
    predictionId,
    organizationId,
    metric,
    predictedValue,
    actualValue,
    error,
    absoluteErrorPercent: Math.round(absoluteErrorPercent * 100) / 100,
    wasCorrect,
    occurredAt: new Date(),
  }

  const db = createServiceClient()
  await db.from(FEEDBACK_TABLE).insert({
    prediction_id: predictionId,
    organization_id: organizationId,
    metric,
    predicted_value: predictedValue,
    actual_value: actualValue,
    error,
    absolute_error_percent: outcome.absoluteErrorPercent,
    was_correct: wasCorrect,
    outcome_type: "prediction",
  })

  await updateCalibration(organizationId, metric, wasCorrect)

  return outcome
}

export async function recordActionOutcome(outcome: ActionOutcome): Promise<void> {
  const db = createServiceClient()
  await db.from(FEEDBACK_TABLE).insert({
    action_id: outcome.actionId,
    organization_id: outcome.organizationId,
    action_type: outcome.actionType,
    module: outcome.module,
    was_successful: outcome.wasSuccessful,
    time_to_complete: outcome.timeToComplete,
    notes: outcome.notes,
    outcome_type: "action",
  })
}

async function updateCalibration(
  organizationId: string,
  metric: string,
  wasCorrect: boolean,
): Promise<void> {
  const db = createServiceClient()
  const { data: existing } = await db
    .from(CONFIDENCE_CALIBRATION_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("metric", metric)
    .maybeSingle()

  if (existing) {
    const total = (existing.total_predictions as number) + 1
    const correct = (existing.correct_predictions as number) + (wasCorrect ? 1 : 0)
    const accuracy = correct / total
    const calibrationError = Math.abs(accuracy - (existing.average_confidence as number))

    await db.from(CONFIDENCE_CALIBRATION_TABLE).update({
      total_predictions: total,
      correct_predictions: correct,
      accuracy,
      calibration_error: Math.round(calibrationError * 10000) / 10000,
      last_updated: new Date().toISOString(),
    }).eq("id", existing.id)
  } else {
    await db.from(CONFIDENCE_CALIBRATION_TABLE).insert({
      organization_id: organizationId,
      metric,
      total_predictions: 1,
      correct_predictions: wasCorrect ? 1 : 0,
      accuracy: wasCorrect ? 1 : 0,
      average_confidence: 0.8,
      calibration_error: 0.2,
    })
  }
}

export async function getCalibration(
  organizationId: string,
  metric?: string,
): Promise<ConfidenceCalibration[]> {
  const db = createServiceClient()
  let query = db
    .from(CONFIDENCE_CALIBRATION_TABLE)
    .select("*")
    .eq("organization_id", organizationId)

  if (metric) query = query.eq("metric", metric)

  const { data } = await query.order("last_updated", { ascending: false }).limit(50)
  return ((data as Array<Record<string, unknown>>) || []).map((r) => ({
    metric: r.metric as string,
    totalPredictions: r.total_predictions as number,
    correctPredictions: r.correct_predictions as number,
    accuracy: r.accuracy as number,
    averageConfidence: r.average_confidence as number,
    calibrationError: r.calibration_error as number,
    lastUpdated: new Date(r.last_updated as string),
  }))
}

export async function adjustConfidence(
  organizationId: string,
  metric: string,
  baseConfidence: number,
): Promise<number> {
  const cal = await getCalibration(organizationId, metric)
  if (cal.length === 0) return baseConfidence

  const c = cal[0]
  if (c.totalPredictions < 5) return baseConfidence

  const accuracyBonus = (c.accuracy - 0.5) * 0.3
  const adjusted = Math.max(0.1, Math.min(0.99, baseConfidence + accuracyBonus))
  return Math.round(adjusted * 100) / 100
}
