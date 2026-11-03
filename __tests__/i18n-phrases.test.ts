import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import hi from "@/lib/i18n/phrases/hi.json"
import pa from "@/lib/i18n/phrases/pa.json"
import { translatePhrase, normalizePhrase } from "@/lib/i18n/phrases"
import { LANDING_FAQ } from "@/components/digit/landing-faq"
import { INDUSTRIES } from "@/lib/industries"

// Text that is intentionally identical in every language.
const UNTRANSLATED_OK = /^(?:[\w.+-]+@[\w.-]+|[\w-]+\.(?:com|org)|k-Anon|🔍 Login Check v2)$/

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === "node_modules" ? [] : tsxFiles(p)
    return p.endsWith(".tsx") ? [p] : []
  })
}

const decode = (s: string) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")

function phrasesInCode(): string[] {
  const out = new Set<string>()
  for (const file of [...tsxFiles("app"), ...tsxFiles("components")]) {
    const src = readFileSync(file, "utf8")
    for (const m of src.matchAll(/<T>([\s\S]*?)<\/T>/g)) out.add(normalizePhrase(decode(m[1])))
    // Literal toast messages sent through the translating wrapper.
    if (src.includes('from "@/lib/i18n/toast"')) {
      for (const m of src.matchAll(/toast\.\w+\(\s*(?:[^,()"'`]*\|\|\s*)?["']([^"']+)["']/g)) out.add(normalizePhrase(m[1]))
    }
    // tx("literal") / title: "..." strings rendered through tx() on the homepage
    if (file.endsWith("landing-page.tsx")) {
      for (const m of src.matchAll(/(?:title|desc): "([^"]+)"/g)) out.add(normalizePhrase(m[1]))
    }
    for (const m of src.matchAll(/<(?:Input|Textarea|SelectValue)\b[^>]*?placeholder="([^"]*[A-Za-z]{2}[^"]*)"/g)) {
      out.add(normalizePhrase(m[1]))
    }
  }
  for (const { q, a } of LANDING_FAQ) {
    out.add(normalizePhrase(q))
    out.add(normalizePhrase(a))
  }
  for (const i of INDUSTRIES) {
    for (const text of [i.name, i.headline, i.summary, ...i.setup, ...i.uses.flatMap((u) => [u.module, u.text])]) {
      out.add(normalizePhrase(text))
    }
  }
  return [...out]
}

describe("phrase translations", () => {
  const phrases = phrasesInCode()

  it("finds the wrapped UI phrases", () => {
    expect(phrases.length).toBeGreaterThan(1000)
  })

  it.each([["hi", hi as Record<string, string>], ["pa", pa as Record<string, string>]])(
    "every <T> phrase and placeholder has a %s translation",
    (_lang, table) => {
      const missing = phrases.filter((p) => !UNTRANSLATED_OK.test(p) && !(p in table))
      expect(missing).toEqual([])
    },
  )

  it("falls back to English and preserves surrounding whitespace", () => {
    expect(translatePhrase("hi", "  Add Task ")).toBe("  कार्य जोड़ें ")
    expect(translatePhrase("hi", "Something brand new")).toBe("Something brand new")
    expect(translatePhrase("en", "Add Task")).toBe("Add Task")
  })
})
