import { describe, it, expect } from "vitest"
import { SUBSCRIPTION_PLANS, getPlanById, formatPrice } from "@/lib/products"

describe("SUBSCRIPTION_PLANS", () => {
  it("has three plans", () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(3)
  })

  it("each plan has required fields", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      expect(plan.id).toBeTruthy()
      expect(plan.name).toBeTruthy()
      expect(plan.priceInCents).toBeGreaterThan(0)
      expect(plan.annualPriceInCents).toBeGreaterThan(0)
      expect(plan.features.length).toBeGreaterThan(0)
    }
  })

  it("starter has lowest price", () => {
    const starter = SUBSCRIPTION_PLANS[0]
    const professional = SUBSCRIPTION_PLANS[1]
    expect(starter.priceInCents).toBeLessThan(professional.priceInCents)
  })

  it("enterprise has highest price", () => {
    const enterprise = SUBSCRIPTION_PLANS[2]
    const professional = SUBSCRIPTION_PLANS[1]
    expect(enterprise.priceInCents).toBeGreaterThan(professional.priceInCents)
  })
})

describe("getPlanById", () => {
  it("returns correct plan", () => {
    const plan = getPlanById("professional")
    expect(plan?.name).toBe("Professional")
    expect(plan?.priceInCents).toBe(39900)
  })

  it("returns undefined for unknown id", () => {
    expect(getPlanById("nonexistent")).toBeUndefined()
  })
})

describe("formatPrice", () => {
  it("formats cents to dollar string", () => {
    expect(formatPrice(9900)).toBe("$99")
    expect(formatPrice(39900)).toBe("$399")
    expect(formatPrice(149900)).toBe("$1,499")
  })

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("$0")
  })
})
