import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  subscription: null as Record<string, unknown> | null,
  owner: null as { id: string } | null,
  updates: [] as Array<Record<string, unknown>>,
  updateError: null as { message: string } | null,
  trackTrialEnded: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/audit", () => ({ logAuthEvent: vi.fn() }))
vi.mock("@/lib/analytics/billing-events", () => ({
  trackTrialStarted: vi.fn(),
  trackTrialEnded: state.trackTrialEnded,
  trackFirstPayment: vi.fn(),
  trackRefundRequested: vi.fn(),
  trackRefundProcessed: vi.fn(),
  trackSubscriptionCancelled: vi.fn(),
}))
vi.mock("@/lib/billing/proration", () => ({ calculateProration: vi.fn(), executePlanChange: vi.fn() }))
vi.mock("@/lib/billing/dunning", () => ({ recordFailedPayment: vi.fn(), retryDunning: vi.fn(), getDunningStatus: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const method of ["select", "eq", "in", "order", "limit"]) {
        chain[method] = () => chain
      }
      chain.maybeSingle = async () =>
        table === "profiles" ? { data: state.owner, error: null } : { data: state.subscription, error: null }
      chain.update = (values: Record<string, unknown>) => {
        state.updates.push(values)
        return {
          eq: () => ({
            eq: () => ({
              select: async () =>
                state.updateError ? { data: null, error: state.updateError } : { data: [{ id: "sub" }], error: null },
            }),
          }),
        }
      }
      return chain
    },
  }),
}))

import { expireTrialIfDue, TRIAL_DAYS } from "@/lib/billing/subscription-lifecycle"
import { STANDARD_TRIAL_DAYS } from "@/lib/products"

const past = new Date(Date.now() - 60_000).toISOString()
const future = new Date(Date.now() + 60_000).toISOString()
const unpaidTrial = {
  id: "sub",
  status: "trialing",
  plan_id: "starter",
  trial_ends_at: past,
  locked_price_cents: null,
  stripe_subscription_id: null,
  razorpay_subscription_id: null,
}

describe("expireTrialIfDue", () => {
  beforeEach(() => {
    state.subscription = { ...unpaidTrial }
    state.owner = { id: "owner-1" }
    state.updates = []
    state.updateError = null
    state.trackTrialEnded.mockClear()
  })

  it("expires an unpaid trial past its end date and credits the owner", async () => {
    await expect(expireTrialIfDue("org")).resolves.toEqual({ expired: true })
    expect(state.updates[0].status).toBe("expired")
    expect(state.trackTrialEnded).toHaveBeenCalledWith("org", "owner-1", "starter")
  })

  it("still expires a trial for an org with no members", async () => {
    state.owner = null
    await expect(expireTrialIfDue("org")).resolves.toEqual({ expired: true })
    expect(state.trackTrialEnded).toHaveBeenCalledWith("org", null, "starter")
  })

  it("leaves a trial alone before its end date", async () => {
    state.subscription = { ...unpaidTrial, trial_ends_at: future }
    await expect(expireTrialIfDue("org")).resolves.toEqual({ expired: false })
    expect(state.updates).toHaveLength(0)
  })

  it("leaves a trial with no end date alone", async () => {
    state.subscription = { ...unpaidTrial, trial_ends_at: null }
    await expect(expireTrialIfDue("org")).resolves.toEqual({ expired: false })
    expect(state.updates).toHaveLength(0)
  })

  it.each([
    ["an annual customer with a locked price", { locked_price_cents: 49900 }],
    ["a customer with a 100% discount", { locked_price_cents: 0 }],
    ["a Stripe subscriber", { stripe_subscription_id: "sub_123" }],
    ["a Razorpay subscriber", { razorpay_subscription_id: "sub_456" }],
  ])("does not expire %s, who is charged at trial end instead", async (_label, fields) => {
    state.subscription = { ...unpaidTrial, ...fields }
    await expect(expireTrialIfDue("org")).resolves.toEqual({ expired: false })
    expect(state.updates).toHaveLength(0)
  })

  it("reports not expired when the database rejects the update", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    state.updateError = { message: "violates check constraint" }
    await expect(expireTrialIfDue("org")).resolves.toEqual({ expired: false })
    expect(state.trackTrialEnded).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})

describe("trial length", () => {
  it("uses the 1-month trial the site promises on every path", () => {
    expect(TRIAL_DAYS).toBe(STANDARD_TRIAL_DAYS)
    expect(TRIAL_DAYS).toBe(30)
  })
})
