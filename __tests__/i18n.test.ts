import { describe, it, expect } from "vitest"
import { dictionaries } from "@/lib/i18n/dictionaries"

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function t(key: string, params?: Record<string, string | number>) {
  const dict = dictionaries.en
  const value = getNestedValue(dict as Record<string, unknown>, key)
  if (typeof value !== "string") return key
  return value.replace(/{(\w+)}/g, (_, k) => String(params?.[k] ?? `{${k}}`))
}

describe("i18n", () => {
  describe("getNestedValue", () => {
    it("resolves a top-level key", () => {
      expect(getNestedValue({ a: "hello" }, "a")).toBe("hello")
    })

    it("resolves a nested key", () => {
      expect(getNestedValue({ a: { b: "c" } }, "a.b")).toBe("c")
    })

    it("returns undefined for missing key", () => {
      expect(getNestedValue({ a: "b" }, "a.c")).toBeUndefined()
    })

    it("returns undefined for missing path entirely", () => {
      expect(getNestedValue({ a: "b" }, "x.y.z")).toBeUndefined()
    })
  })

  describe("t() fallback behavior", () => {
    it("returns the key itself when translation is missing", () => {
      expect(t("nonexistent.key")).toBe("nonexistent.key")
    })

    it("returns the key when path resolves to non-string", () => {
      expect(t("dashboard")).toBe("dashboard")
    })

    it("returns translation when key exists", () => {
      expect(t("common.loading")).toBe("Loading")
    })

    it("interpolates params", () => {
      expect(t("dashboard.page.authError", { msg: "test" })).toBe(
        "Authentication error: test"
      )
    })

    it("handles dashboard.error.title after deduplication", () => {
      expect(t("dashboard.error.title")).toBe("An error occurred")
    })
  })

  describe("locale dictionaries", () => {
    it("english dictionary has all required top-level keys", () => {
      expect(dictionaries.en).toHaveProperty("common")
      expect(dictionaries.en).toHaveProperty("dashboard")
      expect(dictionaries.en).toHaveProperty("languageBanner")
    })

    it("all locales have the same top-level keys", () => {
      const enKeys = Object.keys(dictionaries.en).sort()
      const hiKeys = Object.keys(dictionaries.hi).sort()
      const paKeys = Object.keys(dictionaries.pa).sort()
      expect(hiKeys).toEqual(enKeys)
      expect(paKeys).toEqual(enKeys)
    })
  })
})
