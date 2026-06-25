export interface InventoryItem {
  id: string; sku: string; name: string; leadTime: number; holdingCost: number; orderingCost: number
  annualDemand: number; currentStock: number; reorderPoint: number; economicOrderQty: number; unitPrice: number
}

export function calculateEOQ(annualDemand: number, orderingCost: number, holdingCost: number): number {
  return Math.round(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost))
}

export function calculateROP(leadTime: number, annualDemand: number, safetyStock: number): number {
  return Math.ceil((annualDemand / 365) * leadTime + safetyStock)
}

export function detectReorderNeeded(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item.currentStock <= item.reorderPoint)
}

export function calculateInventoryTurnover(cogs: number, avgInventory: number): number {
  return avgInventory === 0 ? 0 : Math.round((cogs / avgInventory) * 100) / 100
}

export interface VendorScorecard {
  vendorId: string; name: string; quality: number; delivery: number; cost: number; compliance: number; overall: number
  trend: "up" | "down" | "stable"; lastAuditDate: Date; issues: number; category: string
}

export function scoreVendor(
  name: string, category: string,
  quality: number, delivery: number, cost: number, compliance: number,
  weights?: { quality: number; delivery: number; cost: number; compliance: number }
): VendorScorecard {
  const w = weights || { quality: 0.3, delivery: 0.25, cost: 0.25, compliance: 0.2 }
  const overall = quality * w.quality + delivery * w.delivery + cost * w.cost + compliance * w.compliance
  const issues = [quality < 70, delivery < 70, cost < 70, compliance < 70].filter(Boolean).length
  return {
    vendorId: `vendor-${Date.now()}`,
    name, category, quality, delivery, cost, compliance,
    overall: Math.round(overall * 10) / 10,
    trend: overall >= 85 ? "up" : overall >= 70 ? "stable" : "down",
    lastAuditDate: new Date(), issues,
  }
}

export interface CapacityMetric {
  resource: string; total: number; used: number; available: number; utilization: number
  trend: Array<{ date: string; utilization: number }>
}

export function calculateCapacityMetrics(resources: Array<{ name: string; total: number; used: number }>): CapacityMetric[] {
  return resources.map((r) => ({
    resource: r.name,
    total: r.total,
    used: r.used,
    available: r.total - r.used,
    utilization: Math.round((r.used / r.total) * 100),
    trend: Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      return { date: d.toLocaleDateString("en-US", { month: "short" }), utilization: Math.round((r.used / r.total) * 100 + (Math.random() - 0.5) * 10) }
    }),
  }))
}

export interface Reservation {
  id: string; resourceId: string; resourceType: string; startTime: Date; endTime: Date; userId: string; status: "confirmed" | "pending" | "cancelled"; notes?: string
}

export function checkAvailability(
  reservations: Reservation[], resourceId: string, startTime: Date, endTime: Date
): boolean {
  return !reservations.some(
    (r) => r.resourceId === resourceId && r.status !== "cancelled" && startTime < r.endTime && endTime > r.startTime
  )
}

export interface SkillMatrixEntry {
  userId: string; name: string; skills: Array<{ name: string; level: "expert" | "advanced" | "intermediate" | "beginner"; yearsExperience: number; lastUsed: Date }>
}

export function findSkillGaps(
  team: SkillMatrixEntry[], requiredSkills: string[]
): Array<{ skill: string; coverage: number; gaps: string[] }> {
  return requiredSkills.map((skill) => {
    const qualified = team.filter((m) => m.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase() && (s.level === "expert" || s.level === "advanced")))
    return {
      skill,
      coverage: Math.round((qualified.length / team.length) * 100),
      gaps: team.filter((m) => !qualified.includes(m)).map((m) => m.name),
    }
  })
}
