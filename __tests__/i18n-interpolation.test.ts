import { describe, it, expect } from "vitest"
import en from "@/lib/i18n/translations/en.json"
import hi from "@/lib/i18n/translations/hi.json"
import pa from "@/lib/i18n/translations/pa.json"

// Same regex as lib/i18n/server.ts and components/providers/i18n-provider.tsx.
const interpolate = (value: string, params: Record<string, string>) =>
  value.replace(/\{\{?(\w+)\}?\}/g, (_, k) => String(params?.[k] ?? `{${k}}`))

describe("i18n interpolation", () => {
  it("fills both {x} and {{x}} placeholders", () => {
    expect(interpolate("{{planName}} Plan", { planName: "DigiT" })).toBe("DigiT Plan")
    expect(interpolate("{count} days remaining", { count: "5" })).toBe("5 days remaining")
  })

  it("renders the settings plan title without stray braces in every language", () => {
    for (const dict of [en, hi, pa]) {
      const out = interpolate(dict.settings.subscription.plan, { planName: "DigiT" })
      expect(out).toContain("DigiT")
      expect(out).not.toMatch(/[{}]/)
    }
  })

  it("no longer advertises a 7-day trial anywhere", () => {
    for (const dict of [en, hi, pa]) {
      const json = JSON.stringify(dict)
      expect(json).not.toMatch(/7-day free trial|7-Day Free Trial|day 8/)
    }
  })
})
