import { NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { ensureUserProfile } from "@/lib/auth/ensure-profile"

/**
 * POST /api/auth/google-post-signin
 *
 * Google sign-in on the web runs entirely client-side via Google Identity
 * Services + supabase.auth.signInWithIdToken() (see app/auth/login/page.tsx
 * and app/auth/sign-up/page.tsx) specifically so the browser never redirects
 * through Supabase's own domain for the OAuth handshake -- Google's consent
 * screen and account-security emails then correctly show digit-ai.org
 * instead of the project's *.supabase.co subdomain.
 *
 * The tradeoff: that flow never touches app/auth/callback/route.ts (which
 * only runs for the redirect-based PKCE/OTP flows), so this route exists to
 * do the one thing that still needs the server -- create the profile/org
 * for a brand-new user -- once signInWithIdToken() has already set the
 * session cookie client-side.
 */
export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    const result = await ensureUserProfile(user, (reason) => NextResponse.json({ error: reason }, { status: 500 }))
    if (result.errorResponse) return result.errorResponse
    return NextResponse.json({ needsOnboarding: result.needsOnboarding })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
