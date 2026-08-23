"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Minimal ambient shape for the bits of Google Identity Services (GSI) this
// component actually uses -- the full type surface lives in @types/google.accounts,
// which isn't worth adding as a dependency for four fields.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client"

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`)
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }))
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GSI_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"))
    document.head.appendChild(script)
  })
}

interface GoogleIdentityButtonProps {
  /** Where to send the user after a successful sign-in (and profile creation, if new). */
  redirectTo?: string
  onError?: (message: string) => void
}

/**
 * Renders Google's own "Sign in with Google" button and completes the
 * sign-in entirely client-side: Google Identity Services -> a signed ID
 * token -> supabase.auth.signInWithIdToken(). Deliberately NOT
 * supabase.auth.signInWithOAuth() -- that redirects through
 * <project-ref>.supabase.co, which is what Google shows the user as the
 * party receiving their data. This flow never leaves digit-ai.org from the
 * browser's perspective (Supabase only exchanges the token server-side).
 *
 * Uses Google's rendered button widget rather than a fully custom-styled
 * one -- the alternative (One Tap `prompt()`) can be silently suppressed by
 * browser heuristics or third-party-cookie restrictions, which isn't
 * acceptable for the primary sign-in action.
 */
export function GoogleIdentityButton({ redirectTo = "/", onError }: GoogleIdentityButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId || !containerRef.current) return

    let cancelled = false

    const handleCredential = async (response: { credential: string }) => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
        })
        if (signInError) throw signInError

        const res = await fetch("/api/auth/google-post-signin", { method: "POST" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to complete sign-in")

        router.push(data.needsOnboarding ? "/onboarding" : redirectTo)
      } catch (err) {
        setLoading(false)
        onError?.(err instanceof Error ? err.message : "Google sign-in failed")
      }
    }

    loadGsiScript().then(() => {
      if (cancelled || !window.google || !containerRef.current) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential })
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 360,
      })
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex justify-center">
      <div ref={containerRef} className={loading ? "pointer-events-none opacity-60" : undefined} />
    </div>
  )
}
