import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { getClientIp } from "@/lib/auth/audit"

// POST /api/auth/forgot-password
// Sends a password-reset email. There was previously no "forgot password"
// entry point anywhere in the app -- resetPasswordForEmail was never called
// at all -- so this is a genuinely new (not just fixed) flow.
export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const clientIp = getClientIp(request.headers) ?? "unknown"
  const [ipLimited, emailLimited] = await Promise.all([
    checkTenantRateLimit(`forgot-password-ip:${clientIp}`, 60, 10),
    checkTenantRateLimit(`forgot-password-email:${normalizedEmail}`, 60, 3),
  ])

  if (ipLimited || emailLimited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!siteUrl) {
    console.error("[auth] Missing canonical site URL for forgot-password")
    return NextResponse.json({ error: "This is temporarily unavailable" }, { status: 503 })
  }

  const redirectTo = new URL("/auth/callback", siteUrl)
  redirectTo.searchParams.set("next", "/auth/reset-password")

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: redirectTo.toString(),
  })

  // Anti-enumeration: Supabase's own resetPasswordForEmail already doesn't
  // reveal whether the email exists (it silently no-ops for unknown
  // addresses without erroring) -- match that posture in this response too.
  if (error) {
    console.error("[auth] resetPasswordForEmail failed:", error.message)
  }

  return NextResponse.json({
    success: true,
    message: "If an account exists for that email, a password reset link is on its way.",
  })
}
