"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const SESSION_KEY = "digit_visit_session"

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    // sessionStorage unavailable (privacy mode, etc.) -- fall back to a
    // per-page-load id; visits still record, just without cross-page
    // session grouping for that visitor.
    return crypto.randomUUID()
  }
}

/**
 * Records real page views for the public marketing site (founder ask:
 * "see who is visiting my site and from where"). Mounted once in the root
 * layout, but deliberately skips authenticated sessions -- getSession()
 * reads from local storage, no network call -- so this tracks anonymous
 * site/prospect traffic, not an existing paying customer's internal team
 * using the product. That's a different, bigger feature nobody asked for.
 *
 * Fires via sendBeacon so the request survives immediate navigation (a
 * visitor clicking through before a normal fetch would resolve).
 */
export function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    const track = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled || session) return

      const payload = JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        sessionId: getOrCreateSessionId(),
      })

      const url = "/api/v1/track/visit"
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }))
      } else {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {})
      }
    }

    track()
    return () => {
      cancelled = true
    }
  }, [pathname])

  return null
}
