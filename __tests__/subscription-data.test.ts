import { describe, it, expect } from "vitest"
import { pricingTiers, addOns, platformModules } from "@/lib/subscription-data"

describe("pricingTiers", () => {
  it("has three tiers", () => {
    expect(pricingTiers.length).toBe(3)
  })

  it("each tier has required fields", () => {
    for (const tier of pricingTiers) {
      expect(tier.id).toBeTruthy()
      expect(tier.name).toBeTruthy()
      expect(tier.monthlyPrice).toBeGreaterThan(0)
      expect(tier.features.length).toBeGreaterThan(0)
    }
  })

  it("starter has lowest monthly price", () => {
    expect(pricingTiers[0].monthlyPrice).toBeLessThan(pricingTiers[1].monthlyPrice)
  })

  it("enterprise has highest monthly price", () => {
    expect(pricingTiers[2].monthlyPrice).toBeGreaterThan(pricingTiers[1].monthlyPrice)
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