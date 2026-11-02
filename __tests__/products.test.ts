import { describe, it, expect } from "vitest"
import {
  SUBSCRIPTION_PLANS,
  getPlanById,
  getValidatedPlanId,
  resolvePlan,
  formatPrice,
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  STANDARD_TRIAL_DAYS,
} from "@/lib/products"

// Pricing moved to a single all-inclusive plan ($499/year or $44.49/month);
// these replace the old three-tier (starter/professional/enterprise) tests.
describe("SUBSCRIPTION_PLANS", () => {
  it("has the single digit_annual plan", () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(1)
    expect(SUBSCRIPTION_PLANS[0].id).toBe("digit_annual")
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

  it("is priced at $499/year or $44.49/month and unlocks all 6 modules", () => {
    const plan = SUBSCRIPTION_PLANS[0]
    expect(plan.annualPriceInCents).toBe(ANNUAL_PRICE_CENTS)
    expect(plan.priceInCents).toBe(MONTHLY_PRICE_CENTS)
    expect(ANNUAL_PRICE_CENTS).toBe(49_900)
    expect(MONTHLY_PRICE_CENTS).toBe(4_449)
    expect(plan.limits.modules).toBe(6)
  })

  it("annual is cheaper than 12 months of monthly", () => {
    expect(ANNUAL_PRICE_CENTS).toBeLessThan(MONTHLY_PRICE_CENTS * 12)
  })

  it("trial is one month", () => {
    expect(STANDARD_TRIAL_DAYS).toBe(30)
  })
})

describe("getPlanById", () => {
  it("returns the plan for its id", () => {
    expect(getPlanById("digit_annual")?.name).toBe("DigiT")
  })

  it("returns undefined for unknown or legacy ids", () => {
    expect(getPlanById("nonexistent")).toBeUndefined()
    expect(getPlanById("professional")).toBeUndefined()
  })
})

describe("getValidatedPlanId", () => {
  it("falls back to the real plan for unknown input", () => {
    expect(getValidatedPlanId("pro-trial")).toBe("digit_annual")
    expect(getValidatedPlanId(undefined)).toBe("digit_annual")
    expect(getValidatedPlanId("digit_annual")).toBe("digit_annual")
  })
})

describe("resolvePlan", () => {
  it("maps legacy plan ids on existing subscriptions to the single plan", () => {
    for (const legacy of ["starter", "professional", "enterprise", "pro", "pro-trial", "enterprise-trial"]) {
      expect(resolvePlan(legacy)?.id).toBe("digit_annual")
    }
  })

  it("returns undefined when there is no plan id", () => {
    expect(resolvePlan(null)).toBeUndefined()
    expect(resolvePlan(undefined)).toBeUndefined()
    expect(resolvePlan("")).toBeUndefined()
  })
})

describe("formatPrice", () => {
  it("formats cents to dollar string", () => {
    expect(formatPrice(49900)).toBe("$499")
    expect(formatPrice(4449)).toBe("$44.49")
    expect(formatPrice(224900)).toBe("$2,249")
  })

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("$0")
  })
})
