import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { buildEntry, isPrefetch, redactQuery, shouldLogApi } from "@/lib/activity/log"

describe("activity log", () => {
  it("redacts secret-bearing query parameters", () => {
    const q = redactQuery(new URLSearchParams("code=abc&tab=billing&token=xyz&API_KEY=k"))
    expect(q).toBe("code=[redacted]&tab=billing&token=[redacted]&API_KEY=[redacted]")
    expect(redactQuery(new URLSearchParams(""))).toBeNull()
  })

  it("skips health checks, visit beacons and webhooks", () => {
    expect(shouldLogApi("/api/health")).toBe(false)
    expect(shouldLogApi("/api/v1/track/visit")).toBe(false)
    expect(shouldLogApi("/api/webhooks/stripe")).toBe(false)
    expect(shouldLogApi("/api/v1/crm/contacts")).toBe(true)
  })

  it("treats router prefetches as not user activity", () => {
    expect(isPrefetch(new NextRequest("https://digit-ai.org/crm", { headers: { "next-router-prefetch": "1" } }))).toBe(true)
    expect(isPrefetch(new NextRequest("https://digit-ai.org/crm", { headers: { "sec-purpose": "prefetch" } }))).toBe(true)
    expect(isPrefetch(new NextRequest("https://digit-ai.org/crm"))).toBe(false)
  })

  it("builds an entry from the request", () => {
    const req = new NextRequest("https://digit-ai.org/api/v1/crm/contacts?page=2&password=hunter2", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "UA", referer: "https://digit-ai.org/crm" },
    })
    expect(buildEntry(req, "user-1", "api")).toEqual({
      userId: "user-1",
      kind: "api",
      method: "POST",
      path: "/api/v1/crm/contacts",
      query: "page=2&password=[redacted]",
      referrer: "https://digit-ai.org/crm",
      ip: "203.0.113.7",
      userAgent: "UA",
    })
  })

  it("drops a malformed client IP", () => {
    const req = new NextRequest("https://digit-ai.org/crm", { headers: { "x-forwarded-for": "<script>" } })
    expect(buildEntry(req, "u", "page").ip).toBeNull()
  })
})
