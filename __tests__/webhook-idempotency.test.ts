import { beforeEach, describe, expect, it, vi } from "vitest"
import { claimWebhookEvent, completeWebhookEvent, failWebhookEvent } from "@/lib/billing/idempotency"
import { createServiceClient } from "@/lib/supabase/service"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))

function query(result: { data?: unknown; error?: unknown } = {}) {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.single.mockResolvedValue(result)
  builder.maybeSingle.mockResolvedValue(result)
  return builder
}

function database(...builders: unknown[]) {
  return { from: vi.fn().mockImplementation(() => builders.shift()) }
}

beforeEach(() => vi.clearAllMocks())

describe("webhook event leases", () => {
  it("claims a new delivery as processing", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createServiceClient).mockReturnValue(database({ insert }) as never)

    await expect(claimWebhookEvent("stripe", "evt_1", "invoice.paid")).resolves.toBe(true)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      status: "processing",
      attempts: 1,
    }))
  })

  it("suppresses an already completed delivery", async () => {
    const duplicate = { insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }) }
    const existing = query({ data: { status: "completed", claimed_at: null, attempts: 1 }, error: null })
    vi.mocked(createServiceClient).mockReturnValue(database(duplicate, existing) as never)

    await expect(claimWebhookEvent("stripe", "evt_1")).resolves.toBe(false)
  })

  it("reclaims a failed delivery for retry", async () => {
    const duplicate = { insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }) }
    const existing = query({ data: { status: "failed", claimed_at: "2026-07-19T00:00:00.000Z", attempts: 1 }, error: null })
    const retry = query({ data: { id: "row_1" }, error: null })
    vi.mocked(createServiceClient).mockReturnValue(database(duplicate, existing, retry) as never)

    await expect(claimWebhookEvent("razorpay", "evt_2")).resolves.toBe(true)
    expect(retry.update).toHaveBeenCalledWith(expect.objectContaining({ status: "processing", attempts: 2 }))
  })

  it("does not run concurrently while a lease is active", async () => {
    const duplicate = { insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }) }
    const existing = query({ data: { status: "processing", claimed_at: new Date().toISOString(), attempts: 1 }, error: null })
    vi.mocked(createServiceClient).mockReturnValue(database(duplicate, existing) as never)

    await expect(claimWebhookEvent("stripe", "evt_3")).rejects.toThrow("already processing")
  })

  it("reclaims an expired processing lease", async () => {
    const duplicate = { insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }) }
    const staleClaim = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const existing = query({ data: { status: "processing", claimed_at: staleClaim, attempts: 2 }, error: null })
    const retry = query({ data: { id: "row_1" }, error: null })
    vi.mocked(createServiceClient).mockReturnValue(database(duplicate, existing, retry) as never)

    await expect(claimWebhookEvent("stripe", "evt_stale")).resolves.toBe(true)
    expect(retry.eq).toHaveBeenCalledWith("claimed_at", staleClaim)
  })

  it("marks successful and failed deliveries explicitly", async () => {
    const completed = query({ data: { id: "row_1" }, error: null })
    const failed = query({ error: null })
    vi.mocked(createServiceClient)
      .mockReturnValueOnce(database(completed) as never)
      .mockReturnValueOnce(database(failed) as never)

    await completeWebhookEvent("stripe", "evt_4")
    await failWebhookEvent("stripe", "evt_5", new Error("temporary failure"))

    expect(completed.update).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }))
    expect(failed.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      last_error: "temporary failure",
    }))
  })
})
