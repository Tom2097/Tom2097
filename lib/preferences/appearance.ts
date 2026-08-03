"use client"

/**
 * Real, applied appearance preferences for the Settings panel's Appearance
 * and Accessibility tabs. Previously these were local component state that
 * never touched the DOM -- clicking a color or toggling "High Contrast" did
 * nothing visible. This module actually applies each preference (as CSS
 * custom property overrides / classes on <html>) and persists it to
 * localStorage so it survives reloads without needing a server round trip
 * (these are per-browser cosmetic preferences, not app data).
 *
 * Accent color works by overriding the same CSS custom properties
 * app/globals.css's :root/.dark blocks define (--primary, --accent, etc.).
 * An inline style property set directly on the root element takes
 * precedence over both the light and dark class-based rules, so one
 * override applies regardless of which theme is active.
 */

const STORAGE_KEY = "digit-appearance-prefs"

export const ACCENT_PRESETS = {
  cyan: { label: "Cyan", hue: 195 },
  blue: { label: "Blue", hue: 260 },
  purple: { label: "Purple", hue: 300 },
  pink: { label: "Pink", hue: 340 },
  orange: { label: "Orange", hue: 50 },
  green: { label: "Green", hue: 155 },
} as const

export type AccentName = keyof typeof ACCENT_PRESETS

export interface AppearancePrefs {
  accentColor: AccentName | "default"
  fontSize: number
  highContrast: boolean
  reducedMotion: boolean
}

const DEFAULT_PREFS: AppearancePrefs = {
  accentColor: "default",
  fontSize: 100,
  highContrast: false,
  reducedMotion: false,
}

export function loadAppearancePrefs(): AppearancePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(prefs: AppearancePrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // best-effort; ignore quota/private-mode errors
  }
}

const ACCENT_VARS = ["--primary", "--accent", "--ring", "--chart-1", "--sidebar-primary", "--sidebar-ring"]

function applyAccentColor(name: AppearancePrefs["accentColor"]) {
  const root = document.documentElement
  if (name === "default") {
    for (const v of ACCENT_VARS) root.style.removeProperty(v)
    return
  }
  const hue = ACCENT_PRESETS[name].hue
  const value = `oklch(0.72 0.16 ${hue})`
  for (const v of ACCENT_VARS) root.style.setProperty(v, value)
}

function applyFontSize(percent: number) {
  document.documentElement.style.fontSize = `${percent}%`
}

function applyHighContrast(enabled: boolean) {
  document.documentElement.classList.toggle("high-contrast", enabled)
}

function applyReducedMotion(enabled: boolean) {
  document.documentElement.classList.toggle("reduce-motion", enabled)
}

/** Apply every preference to the DOM. Call once on mount (with the loaded
 * prefs) and again whenever an individual preference changes. */
export function applyAppearancePrefs(prefs: AppearancePrefs) {
  applyAccentColor(prefs.accentColor)
  applyFontSize(prefs.fontSize)
  applyHighContrast(prefs.highContrast)
  applyReducedMotion(prefs.reducedMotion)
}

export function updateAppearancePref<K extends keyof AppearancePrefs>(
  current: AppearancePrefs,
  key: K,
  value: AppearancePrefs[K],
): AppearancePrefs {
  const next = { ...current, [key]: value }
  savePrefs(next)
  applyAppearancePrefs(next)
  return next
}
