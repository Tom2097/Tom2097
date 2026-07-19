import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { getClientIp } from "@/lib/auth/audit"

// POST /api/auth/resend-confirmation
// Lets a user who missed or let their signup confirmation email expire
// request a new one, instead of being stuck with no way to ever complete
// signup (the original flow had no resend path at all).
export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const clientIp = getClientIp(request.headers) ?? "unknown"
  const [ipLimited, emailLimited] = await Promise.all([
    checkTenantRateLimit(`resend-confirmation-ip:${clientIp}`, 30, 5),
    checkTenantRateLimit(`resend-confirmation-email:${normalizedEmail}`, 10, 1),
  ])

  if (ipLimited || emailLimited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!siteUrl) {
    console.error("[auth] Missing canonical site URL for resend-confirmation")
    return NextResponse.json({ error: "This is temporarily unavailable" }, { status: 503 })
  }

  const emailRedirectTo = new URL("/auth/callback", siteUrl)
  emailRedirectTo.searchParams.set("next", "/")

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: { emailRedirectTo: emailRedirectTo.toString() },
  })

  // Supabase returns a generic error here for both "already confirmed" and
  // genuine failures, and enumerating which is true would leak account
  // existence -- always report success to the caller either way, matching
  // the same anti-enumeration posture as the sign-up route itself.
  if (error) {
    console.error("[auth] resend-confirmation failed:", error.message)
  }

  return NextResponse.json({
    success: true,
    message: "If that account needs verification, a new email is on its way.",
  })
}
