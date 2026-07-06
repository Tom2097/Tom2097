"use server"

import { createServiceClient } from "@/lib/supabase/service"

export interface TelemetryReading {
  assetId: string
  timestamp: string
  temperature?: number
  vibration?: number
  pressure?: number
  rpm?: number
  powerConsumption?: number
  humidity?: number
}

export interface RULEstimate {
  assetId: string
  assetName: string
  estimatedRulDays: number
  confidenceLevel: "high" | "medium" | "low"
  remainingCycles?: number
  recommendedAction: "monitor" | "inspect" | "maintain" | "replace"
  failureProbability: number
  nextMaintenanceDate: string
}

export interface MaintenanceAlert {
  assetId: string
  assetName: string
  alertType: "anomaly" | "threshold_breach" | "degradation" | "predictive"
  severity: "info" | "warning" | "critical"
  message: string
  timestamp: string
  acknowledged: boolean
}

export async function ingestTelemetry(reading: TelemetryReading): Promise<boolean> {
  const supabase = await createServiceClient()
  const { error } = await supabase.from("asset_telemetry").insert({
    asset_id: reading.assetId,
    timestamp: reading.timestamp,
    temperature: reading.temperature,
    vibration: reading.vibration,
    pressure: reading.pressure,
    rpm: reading.rpm,
    power_consumption: reading.powerConsumption,
    humidity: reading.humidity,
  })
  return !error
}

export async function ingestBatchTelemetry(readings: TelemetryReading[]): Promise<number> {
  let success = 0
  for (const reading of readings) {
    if (await ingestTelemetry(reading)) success++
  }
  return success
}

export async function calculateRUL(assetId: string): Promise<RULEstimate> {
  if (!assetId) {
    throw new Error("Asset ID is required")
  }
  
  const supabase = await createServiceClient()

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, name, asset_type, installation_date, expected_lifespan_days")
    .eq("id", assetId)
    .single()

  if (assetError || !asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  const { data: telemetry, error: telemetryError } = await supabase
    .from("asset_telemetry")
    .select("*")
    .eq("asset_id", assetId)
    .order("timestamp", { ascending: false })
    .limit(100)

  if (telemetryError) {
    throw new Error(`Failed to fetch telemetry data: ${telemetryError.message}`)
  }

  const readings = telemetry || []

  if (readings.length === 0) {
    throw new Error("No telemetry data available for RUL calculation")
  }

  const installedDate = new Date(asset.installation_date)
  const daysSinceInstall = Math.floor((Date.now() - installedDate.getTime()) / (1000 * 60 * 60 * 24))
  const expectedLifespan = asset.expected_lifespan_days || 3650

  let healthScore = 1.0
  const temps = readings.filter(r => r.temperature !== undefined && r.temperature !== null).map(r => r.temperature!)
  const vibes = readings.filter(r => r.vibration !== undefined && r.vibration !== null).map(r => r.vibration!)
  const pressures = readings.filter(r => r.pressure !== undefined && r.pressure !== null).map(r => r.pressure!)
  const rpms = readings.filter(r => r.rpm !== undefined && r.rpm !== null).map(r => r.rpm!)

  if (temps.length > 0) {
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length
    if (avgTemp > 80) healthScore -= 0.3
    else if (avgTemp > 60) healthScore -= 0.1
  }

  if (vibes.length > 0) {
    const avgVibe = vibes.reduce((a, b) => a + b, 0) / vibes.length
    if (avgVibe > 10) healthScore -= 0.2
    else if (avgVibe > 5) healthScore -= 0.1
  }

  if (pressures.length > 0) {
    const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length
    if (avgPressure > 150) healthScore -= 0.15
    else if (avgPressure < 80) healthScore -= 0.1
  }

  if (rpms.length > 0) {
    const avgRpm = rpms.reduce((a, b) => a + b, 0) / rpms.length
    if (avgRpm > 3000) healthScore -= 0.2
    else if (avgRpm > 2500) healthScore -= 0.1
  }

  healthScore = Math.max(0.1, Math.min(1.0, healthScore))
  const effectiveLifespan = expectedLifespan * healthScore
  const remainingDays = Math.max(0, Math.round(effectiveLifespan - daysSinceInstall))

  const confidenceLevel: RULEstimate["confidenceLevel"] =
    readings.length > 50 ? "high" : readings.length > 10 ? "medium" : "low"

  const failureProb = Math.max(0, Math.min(1, 1 - (remainingDays / expectedLifespan)))
  const recommendedAction: RULEstimate["recommendedAction"] =
    failureProb > 0.8 ? "replace" :
    failureProb > 0.6 ? "maintain" :
    failureProb > 0.3 ? "inspect" : "monitor"

  return {
    assetId: asset.id,
    assetName: asset.name,
    estimatedRulDays: remainingDays,
    confidenceLevel,
    failureProbability: Math.round(failureProb * 100) / 100,
    recommendedAction,
    nextMaintenanceDate: new Date(Date.now() + remainingDays * 0.8 * 86400000).toISOString().split("T")[0],
  }
}

export async function detectAnomalies(assetId: string, sinceHours: number = 24): Promise<MaintenanceAlert[]> {
  const supabase = await createServiceClient()

  const { data: asset } = await supabase
    .from("assets")
    .select("id, name")
    .eq("id", assetId)
    .single()

  if (!asset) return []

  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()
  const { data: telemetry } = await supabase
    .from("asset_telemetry")
    .select("*")
    .eq("asset_id", assetId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: true })

  const readings = (telemetry as TelemetryReading[]) || []
  const alerts: MaintenanceAlert[] = []

  if (readings.length < 2) return alerts

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1]
    const curr = readings[i]

    if (prev.temperature && curr.temperature) {
      const tempChange = Math.abs(curr.temperature - prev.temperature)
      if (tempChange > 20) {
        alerts.push({
          assetId: asset.id,
          assetName: asset.name,
          alertType: "anomaly",
          severity: "critical",
          message: `Rapid temperature change detected: ${tempChange.toFixed(1)}°C in ${Math.round((new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000)} minutes`,
          timestamp: curr.timestamp,
          acknowledged: false,
        })
      }
    }

    if (curr.temperature && curr.temperature > 85) {
      alerts.push({
        assetId: asset.id,
        assetName: asset.name,
        alertType: "threshold_breach",
        severity: "critical",
        message: `Temperature threshold breached: ${curr.temperature}°C (limit: 85°C)`,
        timestamp: curr.timestamp,
        acknowledged: false,
      })
    }

    if (curr.vibration && curr.vibration > 15) {
      alerts.push({
        assetId: asset.id,
        assetName: asset.name,
        alertType: "anomaly",
        severity: "warning",
        message: `Abnormal vibration detected: ${curr.vibration} mm/s`,
        timestamp: curr.timestamp,
        acknowledged: false,
      })
    }
  }

  return alerts
}

export async function getMaintenanceSchedule(organizationId: string): Promise<RULEstimate[]> {
  const supabase = await createServiceClient()

  const { data: assets } = await supabase
    .from("assets")
    .select("id, name")
    .eq("organization_id", organizationId)

  if (!assets) return []

  const estimates: RULEstimate[] = []
  for (const asset of assets as Array<Record<string, unknown>>) {
    const rul = await calculateRUL(asset.id as string)
    if (rul) estimates.push(rul)
  }

  return estimates.sort((a, b) => a.estimatedRulDays - b.estimatedRulDays)
}
