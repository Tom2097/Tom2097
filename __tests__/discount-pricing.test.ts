import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => {
  const state: { row: Record<string, unknown> | null; updated: Record<string, unknown> | null } = { row: null, updated: null }
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: state.row, error: null }),
    update: (values: Record<string, unknown>) => {
      state.updated = values
      return builder
    },
  }
  return { state, createServiceClient: () => ({ from: () => builder }) }
})

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }))

import { applyDiscount, validateDiscountCode } from "@/lib/billing/discounts"
import { activateTrial } from "@/lib/billing/signup"
import { ANNUAL_PRICE_CENTS, MONTHLY_PRICE_CENTS } from "@/lib/products"

beforeEach(() => {
  mocks.state.row = null
  mocks.state.updated = null
})

describe("applyDiscount", () => {
  it("applies percentage and fixed discounts, never below zero", () => {
    const pct = { code: "X", type: "percentage" as const, value: 30, maxUses: 1, currentUses: 0, expiresAt: null }
    const fixed = { ...pct, type: "fixed" as const, value: 100 }
    expect(applyDiscount(ANNUAL_PRICE_CENTS, pct)).toBe(34_930)
    expect(applyDiscount(ANNUAL_PRICE_CENTS, fixed)).toBe(39_900)
    expect(applyDiscount(MONTHLY_PRICE_CENTS, fixed)).toBe(0)
  })
})

describe("validateDiscountCode", () => {
  it("accepts a code with a legacy min_plan_id for the single digit_annual plan", async () => {
    mocks.state.row = {
      code: "FOUNDER40", discount_type: "percentage", value: 40, max_uses: 10, current_uses: 0,
      expires_at: null, min_plan_id: "enterprise",
    }
    const result = await validateDiscountCode("FOUNDER40", "digit_annual")
    expect(result.valid).toBe(true)
  })

  it("rejects an exhausted code", async () => {
    mocks.state.row = {
      code: "USED", discount_type: "percentage", value: 10, max_uses: 1, current_uses: 1,
      expires_at: null, min_plan_id: null,
    }
    expect((await validateDiscountCode("USED", "digit_annual")).valid).toBe(false)
  })
})

describe("activateTrial", () => {
  it("locks the list price without a discount", async () => {
    const res = await activateTrial("org", "sub", "year")
    expect(res.lockedPriceCents).toBe(ANNUAL_PRICE_CENTS)
    expect(mocks.state.updated?.locked_price_cents).toBe(ANNUAL_PRICE_CENTS)
  })

  it("locks the discounted price when a claimed discount is passed", async () => {
    const discount = { code: "FOUNDER30", type: "percentage" as const, value: 30, maxUses: 0, currentUses: 0, expiresAt: null }
    const res = await activateTrial("org", "sub", "month", discount)
    expect(res.lockedPriceCents).toBe(Math.round(MONTHLY_PRICE_CENTS * 0.7))
    expect(mocks.state.updated?.locked_price_cents).toBe(res.lockedPriceCents)
  })
})
