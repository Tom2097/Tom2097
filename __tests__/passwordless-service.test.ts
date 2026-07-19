import { beforeEach, describe, expect, it, vi } from "vitest"

const { createServiceClient } = vi.hoisted(() => ({ createServiceClient: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient }))
vi.mock("@/lib/logging", () => ({
  logger: { logWarn: vi.fn(), logError: vi.fn() },
}))

import { hashToken, verifyMagicLink } from "@/lib/auth/passwordless/service"

function chain(result: unknown) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ["select", "eq", "update"]) {
    builder[method] = vi.fn(() => builder)
  }
  builder.maybeSingle = vi.fn(async () => result)
  return builder
}

describe("passwordless token consumption", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the user only when the unused token is atomically claimed", async () => {
    const record = {
      id: "token-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }
    const lookup = chain({ data: record })
    const claim = chain({ data: { user_id: "user-1" }, error: null })
    createServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(claim),
    })

    await expect(verifyMagicLink("secret", "USER@example.com")).resolves.toBe("user-1")
    expect(lookup.eq).toHaveBeenCalledWith("token_hash", hashToken("secret"))
    expect(claim.eq).toHaveBeenCalledWith("used", false)
  })

  it("rejects a token lost to a concurrent claimant", async () => {
    const lookup = chain({
      data: {
        id: "token-1",
        user_id: "user-1",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    })
    const claim = chain({ data: null, error: null })
    createServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(claim),
    })

    await expect(verifyMagicLink("secret", "user@example.com")).resolves.toBeNull()
  })
})
