export interface DiscountConfig {
  code: string
  type: "percentage" | "fixed"
  value: number
  maxUses: number
  currentUses: number
  expiresAt: string | null
  minPlanId?: string
}

const DISCOUNTS: DiscountConfig[] = [
  {
    code: "FOUNDER30",
    type: "percentage",
    value: 30,
    maxUses: 20,
    currentUses: 0,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    minPlanId: "professional",
  },
  {
    code: "FOUNDER40",
    type: "percentage",
    value: 40,
    maxUses: 10,
    currentUses: 0,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    minPlanId: "enterprise",
  },
]

export function validateDiscountCode(code: string, planId: string): { valid: boolean; discount?: DiscountConfig; error?: string } {
  const discount = DISCOUNTS.find(d => d.code.toUpperCase() === code.toUpperCase())
  if (!discount) return { valid: false, error: "Invalid discount code" }
  if (discount.currentUses >= discount.maxUses) return { valid: false, error: "Discount code has expired" }
  if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) return { valid: false, error: "Discount code has expired" }
  if (discount.minPlanId) {
    const planPriority = ["starter", "professional", "enterprise"]
    if (planPriority.indexOf(planId) < planPriority.indexOf(discount.minPlanId)) {
      return { valid: false, error: "Discount not available for this plan" }
    }
  }
  return { valid: true, discount }
}

export function applyDiscount(priceInCents: number, discount: DiscountConfig): number {
  if (discount.type === "percentage") {
    return Math.round(priceInCents * (1 - discount.value / 100))
  }
  return Math.max(0, priceInCents - discount.value * 100)
}

export function recordDiscountUse(code: string): void {
  const discount = DISCOUNTS.find(d => d.code === code)
  if (discount) discount.currentUses++
}

export function getFoundingDiscountEligibility(tierId: string): { eligible: boolean; discount?: DiscountConfig } {
  const discount = DISCOUNTS.find(d =>
    (tierId === "professional" && d.code === "FOUNDER30") ||
    (tierId === "enterprise" && d.code === "FOUNDER40")
  )
  if (discount && discount.currentUses < discount.maxUses) {
    return { eligible: true, discount }
  }
  return { eligible: false }
}
