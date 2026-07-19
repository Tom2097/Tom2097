"use server"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { getClientIp } from "@/lib/auth/audit"

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters" }
  if (!/[A-Z]/.test(password)) return { valid: false, error: "Password must contain an uppercase letter" }
  if (!/[a-z]/.test(password)) return { valid: false, error: "Password must contain a lowercase letter" }
  if (!/[0-9]/.test(password)) return { valid: false, error: "Password must contain a number" }
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: "Password must contain a special character" }
  return { valid: true }
}

// POST /api/auth/sign-up
// Starts Supabase's email-verification signup flow. Tenant provisioning happens
// only after the callback has verified the email and established a session.
export async function POST(request: Request) {
  try {
    const { email, password, fullName, companyName } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const clientIp = getClientIp(request.headers) ?? "unknown"
    const [ipLimited, emailLimited] = await Promise.all([
      checkTenantRateLimit(`signup-ip:${clientIp}`, 60, 10),
      checkTenantRateLimit(`signup-email:${normalizedEmail}`, 60, 3),
    ])

    if (ipLimited || emailLimited) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      )
    }

    const supabase = await createClient()
    const db = createServiceClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
    if (!siteUrl) {
      console.error("[auth] Missing canonical site URL for signup verification")
      return NextResponse.json({ error: "Signup is temporarily unavailable" }, { status: 503 })
    }

    // Authoritative pre-check: auth.users isn't exposed over PostgREST, so
    // this RPC (a narrowly-scoped SECURITY DEFINER function, see the
    // check_email_registered migration) is the only reliable way to know
    // this *before* calling signUp -- its own response shape for "already
    // registered" is ambiguous (see below) and was previously being
    // misapplied to genuinely new signups too.
    const { data: alreadyRegistered } = await db.rpc("check_email_registered", { p_email: normalizedEmail })
    if (alreadyRegistered) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 409 }
      )
    }

    const emailRedirectTo = new URL("/auth/callback", siteUrl)
    emailRedirectTo.searchParams.set("next", "/")

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: emailRedirectTo.toString(),
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    })

    // Supabase's signUp() can return {user: null, error: null} for reasons
    // other than "already registered" (the pre-check above already ruled
    // that out). Re-check directly: if the account exists now, the signup
    // actually succeeded despite the ambiguous response -- report success
    // rather than a misleading failure.
    if (!authError && !authData?.user) {
      const { data: nowRegistered } = await db.rpc("check_email_registered", { p_email: normalizedEmail })
      if (nowRegistered) {
        return NextResponse.json({
          success: true,
          requiresEmailVerification: true,
          message: "Check your email to verify your account",
        })
      }
      return NextResponse.json(
        { error: "Failed to create account. Please try again." },
        { status: 400 }
      )
    }

    if (authError || !authData?.user) {
      console.error("[v0] Error creating auth user:", authError)
      return NextResponse.json(
        { error: authError?.message || "Failed to create account" },
        { status: 400 }
      )
    }

    // Supabase returns a session immediately when email confirmation is
    // disabled at the project level. That configuration would bypass the
    // ownership check this endpoint promises, so remove the just-created
    // account and fail closed instead of provisioning it.
    if (authData.session) {
      await supabase.auth.signOut()
      const { error: cleanupError } = await db.auth.admin.deleteUser(authData.user.id)
      if (cleanupError) {
        console.error("[auth] Failed to clean up unverified signup:", cleanupError)
      }
      return NextResponse.json(
        { error: "Signup requires email verification, but it is not enabled" },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      requiresEmailVerification: true,
      message: "Check your email to verify your account",
    })
  } catch (error) {
    console.error("[v0] Error in sign-up:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
