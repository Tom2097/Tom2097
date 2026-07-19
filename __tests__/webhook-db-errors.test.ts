import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock("@/lib/auth/audit", () => ({ logAuthEvent: vi.fn() }))
vi.mock("@/lib/logging", () => ({
  logger: { logInfo: vi.fn(), logError: vi.fn(), logWarn: vi.fn() },
}))
vi.mock("@/lib/billing/idempotency", () => ({
  claimWebhookEvent: mocks.claim,
  completeWebhookEvent: mocks.complete,
  failWebhookEvent: mocks.fail,
}))

import { handleRazorpayWebhook } from "../lib/billing/razorpay.ts"

describe("payment webhook database failures", () => {
  it("fails the lease instead of completing after a returned Supabase error", async () => {
    const databaseError = { message: "database unavailable" }
    const eq = vi.fn().mockResolvedValue({ error: databaseError })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.createServiceClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update }) })
    mocks.claim.mockResolvedValue(true)

    const payload = {
      event: "subscription.activated",
      payload: {
        subscription: {
          entity: {
            id: "sub_1",
            customer_id: "customer_1",
            metadata: { organization_id: "org_1" },
          },
        },
      },
    }

    await expect(handleRazorpayWebhook(payload, "event_1")).rejects.toBe(databaseError)
    expect(mocks.complete).not.toHaveBeenCalled()
    expect(mocks.fail).toHaveBeenCalledWith("razorpay", "event_1", databaseError)
  })
})
