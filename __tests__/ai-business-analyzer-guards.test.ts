// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const state = vi.hoisted(() => ({
  signedIn: false,
  rateLimited: false,
  generateText: vi.fn(async () => ({ text: "{}" })),
  streamText: vi.fn(() => ({})),
}))

vi.mock("ai", () => ({ generateText: state.generateText, streamText: state.streamText }))
vi.mock("@/lib/ai/mistral", () => ({ mistralModel: {} }))
vi.mock("@/lib/auth/server-auth", () => ({
  getAuthenticatedUser: async () => {
    if (!state.signedIn) throw new Error("Unauthorized")
    return { id: "user-1" }
  },
}))
vi.mock("@/lib/multitenant/rate-limit", () => ({
  checkTenantRateLimit: async () => (state.rateLimited ? NextResponse.json({}, { status: 429 }) : null),
}))

import {
  analyzeBusinessProfile,
  generateIndustryIntelligence,
  streamBusinessAnalysis,
  type BusinessProfile,
} from "@/lib/ai-business-analyzer"

const profile = {
  industry: "Manufacturing",
  companySize: "small",
  employeeCountRange: "10-50",
  annualRevenueRange: "1-5M",
  businessStage: "growth",
  primaryGoals: ["efficiency"],
  currentChallenges: ["waste"],
  existingTools: [],
  technicalMaturity: "medium",
  budgetRange: "low",
  timelineUrgency: "soon",
  geographicScope: "national",
  complianceRequirements: [],
} as unknown as BusinessProfile

beforeEach(() => {
  state.signedIn = false
  state.rateLimited = false
  state.generateText.mockClear()
  state.streamText.mockClear()
})

describe("AI business analyzer", () => {
  it.each([
    ["analyzeBusinessProfile", () => analyzeBusinessProfile(profile)],
    ["generateIndustryIntelligence", () => generateIndustryIntelligence("Manufacturing", [])],
    ["streamBusinessAnalysis", () => streamBusinessAnalysis(profile)],
  ])("%s refuses anonymous callers without calling the model", async (_name, call) => {
    await expect(call()).rejects.toThrow("Unauthorized")
    expect(state.generateText).not.toHaveBeenCalled()
    expect(state.streamText).not.toHaveBeenCalled()
  })

  it("rejects oversized input without calling the model", async () => {
    state.signedIn = true
    await expect(analyzeBusinessProfile({ ...profile, industry: "x".repeat(25_000) })).rejects.toThrow("too large")
    expect(state.generateText).not.toHaveBeenCalled()
  })

  it("serves fallback recommendations instead of calling the model when rate limited", async () => {
    state.signedIn = true
    state.rateLimited = true
    const result = await analyzeBusinessProfile(profile)
    expect(state.generateText).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })

  it("calls the model for a signed-in user within their limit", async () => {
    state.signedIn = true
    await analyzeBusinessProfile(profile)
    expect(state.generateText).toHaveBeenCalledOnce()
  })
})
