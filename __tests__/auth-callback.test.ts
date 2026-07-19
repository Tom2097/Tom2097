import { afterEach, describe, expect, it } from "vitest"
import { getCallbackOrigin, sanitizeCallbackPath } from "@/app/auth/callback/route"

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe("authentication callback redirects", () => {
  it.each([
    ["https://evil.example", "/"],
    ["//evil.example/path", "/"],
    ["/\\evil.example/path", "/"],
    ["dashboard", "/"],
    ["/dashboard?tab=security", "/dashboard?tab=security"],
  ])("sanitizes %s", (input, expected) => {
    expect(sanitizeCallbackPath(input)).toBe(expected)
  })

  it("uses the configured origin and ignores forwarded host headers", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://digit-ai.org/base"
    const request = new Request("https://internal:3000/auth/callback", {
      headers: { "x-forwarded-host": "evil.example" },
    })

    expect(getCallbackOrigin(request)).toBe("https://digit-ai.org")
  })

  it("rejects an invalid configured origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a URL"
    expect(getCallbackOrigin(new Request("https://internal/auth/callback"))).toBeNull()
  })
})
