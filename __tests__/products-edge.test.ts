import { describe, it, expect } from "vitest"
import { SUBSCRIPTION_PLANS, getPlanById } from "@/lib/products"

describe("SUBSCRIPTION_PLANS pricing consistency", () => {
  it("annual price is less than 12x monthly", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      expect(plan.annualPriceInCents).toBeLessThan(plan.priceInCents * 12)
    }
  })
})

describe("getPlanById edge cases", () => {
  it("is case-sensitive", () => {
    expect(getPlanById("Starter")).toBeUndefined()
    expect(getPlanById("starter")).toBeDefined()
  })
})