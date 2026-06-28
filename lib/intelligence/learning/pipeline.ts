/**
 * Learning pipeline — scheduled training that runs on the scheduler.
 * Seeds synthetic data, runs predictions, collects feedback, and
 * calibrates confidence.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { seedSyntheticData } from "./synthetic"
import { predict } from "./predictor"
import { getCalibration, adjustConfidence } from "./feedback"
import { runAllMonitors } from "../monitor"
import { getActiveFindings } from "../engine"

export interface LearningRunResult {
  syntheticSeeded: boolean
  predictionsGenerated: number
  calibrationsUpdated: number
  confidenceAdjustments: number
  durationMs: number
}

export async function runLearningCycle(organizationId: string): Promise<LearningRunResult> {
  const start = Date.now()
  const result: LearningRunResult = {
    syntheticSeeded: false,
    predictionsGenerated: 0,
    calibrationsUpdated: 0,
    confidenceAdjustments: 0,
    durationMs: 0,
  }

  const db = createServiceClient()

  const { data: existingModels } = await db
    .from("intelligence_online_models")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1)

  if (!existingModels || existingModels.length === 0) {
    const { metrics } = await seedSyntheticData(organizationId)
    if (metrics > 0) result.syntheticSeeded = true
  }

  const metrics = ["pipeline_value", "compliance_score", "resource_utilization", "production_throughput", "deals_created"]
  for (const metric of metrics) {
    const prediction = await predict(organizationId, metric, 7)
    if (prediction) {
      result.predictionsGenerated++
      const adjusted = await adjustConfidence(organizationId, metric, 0.8)
      result.confidenceAdjustments++
    }
  }

  const calibrations = await getCalibration(organizationId)
  result.calibrationsUpdated = calibrations.length

  result.durationMs = Date.now() - start
  return result
}

export async function backfillFeedback(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data: actions } = await db
    .from("intelligence_actions")
    .select("id, type, target_module, status, agent_id")
    .eq("organization_id", organizationId)
    .in("status", ["completed", "failed"])
    .limit(100)

  if (!actions || actions.length === 0) return 0

  let count = 0
  for (const action of actions as Array<Record<string, unknown>>) {
    const { data: existing } = await db
      .from("intelligence_feedback")
      .select("id")
      .eq("action_id", action.id)
      .limit(1)

    if (!existing || existing.length === 0) {
      await db.from("intelligence_feedback").insert({
        action_id: action.id,
        organization_id: organizationId,
        action_type: action.type,
        module: action.target_module,
        was_successful: action.status === "completed",
        outcome_type: "action",
      })
      count++
    }
  }

  return count
}
