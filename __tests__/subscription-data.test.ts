import { describe, it, expect } from "vitest"
import { pricingTiers, addOns, platformModules } from "@/lib/subscription-data"

describe("pricingTiers", () => {
  it("mirrors the single plan catalog", () => {
    expect(pricingTiers.length).toBe(1)
    expect(pricingTiers[0].id).toBe("digit_annual")
  })

  it("each tier has required fields", () => {
    for (const tier of pricingTiers) {
      expect(tier.id).toBeTruthy()
      expect(tier.name).toBeTruthy()
      expect(tier.monthlyPrice).toBeGreaterThan(0)
      expect(tier.features.length).toBeGreaterThan(0)
    }
  })

  it("derives limits from the plan instead of a 1-user/1-module placeholder", () => {
    expect(pricingTiers[0].limits.users).toBe("unlimited")
    expect(pricingTiers[0].limits.modules).toBe("all")
    expect(pricingTiers[0].monthlyPrice).toBe(44.49)
    expect(pricingTiers[0].annualPrice).toBe(499)
  })
})

describe("addOns", () => {
  it("has four add-ons", () => {
    expect(addOns.length).toBe(4)
  })

  it("each add-on has required fields", () => {
    for (const addon of addOns) {
      expect(addon.id).toBeTruthy()
      expect(addon.name).toBeTruthy()
      expect(addon.price).toBeGreaterThan(0)
    }
  })
})

describe("platformModules", () => {
  it("has six modules", () => {
    expect(platformModules.length).toBe(6)
  })

  it("includes analytics and crm", () => {
    const ids = platformModules.map((m) => m.id)
    expect(ids).toContain("analytics")
    expect(ids).toContain("crm")
  })
})