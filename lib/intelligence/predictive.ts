import { createServiceClient } from "@/lib/supabase/service"

export interface Prediction<T> {
  entityId: string
  metric: string
  currentValue: number
  predictedValue: number
  lowerBound: number
  upperBound: number
  confidence: number
  horizon: string
  factors: Array<{ name: string; impact: number }>
}

export interface LeadTimePrediction {
  itemId: string
  itemName: string
  currentStock: number
  reorderPoint: number
  predictedStockoutDays: number
  confidence: number
  recommendedOrder: number
}

export async function predictStockout(
  organizationId: string,
  itemId: string,
): Promise<LeadTimePrediction | null> {
  const db = createServiceClient()
  const { data: item } = await db
    .from("inventory_items")
    .select("id, name, quantity, reorder_point, usage_rate")
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .single()

  if (!item) return null

  const quantity = item.quantity as number
  const reorder = item.reorder_point as number
  const usageRate = (item.usage_rate as number) || Math.max(1, Math.round(quantity * 0.1))

  const dailyUsage = usageRate
  const daysUntilStockout = Math.max(0, Math.floor((quantity - reorder) / dailyUsage))
  const confidence = Math.min(0.95, 0.5 + (quantity / (reorder * 3)) * 0.45)

  return {
    itemId: item.id as string,
    itemName: item.name as string,
    currentStock: quantity,
    reorderPoint: reorder,
    predictedStockoutDays: daysUntilStockout,
    confidence,
    recommendedOrder: Math.max(reorder * 2 - quantity, 0),
  }
}

export async function predictMaintenanceRisk(
  organizationId: string,
  assetId: string,
): Promise<Prediction<number> | null> {
  const db = createServiceClient()
  const { data: asset } = await db
    .from("assets")
    .select("id, name, next_maintenance, last_maintenance, usage_hours")
    .eq("organization_id", organizationId)
    .eq("id", assetId)
    .single()

  if (!asset) return null

  const nextMaint = new Date(asset.next_maintenance as string).getTime()
  const daysUntilMaint = Math.max(0, Math.ceil((nextMaint - Date.now()) / 86400000))
  const lastMaint = asset.last_maintenance
    ? Math.ceil((Date.now() - new Date(asset.last_maintenance as string).getTime()) / 86400000)
    : 365

  const riskScore = Math.min(100, Math.round((1 - daysUntilMaint / 365) * 70 + (lastMaint / 365) * 30))

  return {
    entityId: asset.id as string,
    metric: "failure_risk",
    currentValue: riskScore,
    predictedValue: Math.min(100, riskScore + 15),
    lowerBound: Math.max(0, riskScore - 10),
    upperBound: Math.min(100, riskScore + 25),
    confidence: 0.8,
    horizon: "30d",
    factors: [
      { name: "days_until_maintenance", impact: -daysUntilMaint },
      { name: "days_since_last_maintenance", impact: lastMaint },
    ],
  }
}

export async function predictDealCloseRisk(
  organizationId: string,
  dealId: string,
): Promise<Prediction<number> | null> {
  const db = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: deal } = await db
    .from("deals")
    .select("id, name, value, stage, updated_at")
    .eq("organization_id", organizationId)
    .eq("id", dealId)
    .single()

  if (!deal) return null

  const updatedAt = new Date(deal.updated_at as string).getTime()
  const daysSinceUpdate = Math.floor((Date.now() - updatedAt) / 86400000)
  const ageInDays = Math.min(daysSinceUpdate, 90)
  const value = deal.value as number

  const stallRisk = Math.min(100, Math.round((ageInDays / 90) * 60 + (value > 50000 ? 20 : 0) + 10))
  const confidence = Math.max(0.5, 1 - ageInDays / 180)

  return {
    entityId: deal.id as string,
    metric: "stall_risk",
    currentValue: stallRisk,
    predictedValue: Math.min(100, stallRisk + 10),
    lowerBound: Math.max(0, stallRisk - 15),
    upperBound: Math.min(100, stallRisk + 20),
    confidence,
    horizon: "14d",
    factors: [
      { name: "days_since_update", impact: ageInDays },
      { name: "deal_value", impact: value > 50000 ? 20 : 5 },
    ],
  }
}

export async function getPredictions(
  organizationId: string,
): Promise<Array<Prediction<unknown> | LeadTimePrediction>> {
  const db = createServiceClient()
  const predictions: Array<Prediction<unknown> | LeadTimePrediction> = []

  const { data: items } = await db
    .from("inventory_items")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(5)

  if (items) {
    for (const item of items as Array<{ id: string }>) {
      const pred = await predictStockout(organizationId, item.id)
      if (pred) predictions.push(pred)
    }
  }

  const { data: assets } = await db
    .from("assets")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(5)

  if (assets) {
    for (const asset of assets as Array<{ id: string }>) {
      const pred = await predictMaintenanceRisk(organizationId, asset.id)
      if (pred) predictions.push(pred)
    }
  }

  return predictions
}
