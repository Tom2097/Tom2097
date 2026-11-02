import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import hi from "@/lib/i18n/phrases/hi.json"
import pa from "@/lib/i18n/phrases/pa.json"
import { translatePhrase, normalizePhrase } from "@/lib/i18n/phrases"

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
    for (const m of src.matchAll(/<(?:Input|Textarea|SelectValue)\b[^>]*?placeholder="([^"]*[A-Za-z]{2}[^"]*)"/g)) {
      out.add(normalizePhrase(m[1]))
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
