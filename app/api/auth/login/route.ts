import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRequestOrigin } from "@/lib/http/request-origin"
import { getClientIp } from "@/lib/auth/audit"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"

/**
 * Only allow same-site relative paths for post-login redirects. Rejects
 * absolute URLs and protocol-relative ("//evil.com") paths so `redirect=
 * https://evil.com` can't send the user offsite right after login.
 * Backslashes are normalized first since some browsers treat "/\evil.com"
 * as protocol-relative too.
 */
function sanitizeRedirectPath(path: string | null | undefined): string {
  if (!path) return "/"
  const normalized = path.replace(/\\/g, "/")
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/"
  return path
}

export async function POST(request: Request) {
  const origin = getRequestOrigin(request)
  const contentType = request.headers.get("content-type") || ""

  let email: string
  let password: string
  let redirectTo = "/"

  if (contentType.includes("application/json")) {
    const body = await request.json()
    email = body.email
    password = body.password
    if (body.redirect) redirectTo = body.redirect
  } else {
    const formData = await request.formData()
    email = formData.get("email") as string
    password = formData.get("password") as string
    redirectTo = (formData.get("redirect") as string) || "/"
  }

  redirectTo = sanitizeRedirectPath(redirectTo)

  if (!email || !password) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent("Email and password required")}`, origin)
    )
  }

  // Brute-force protection, keyed by IP and by email so an attacker can't
  // work around one limit by rotating the other.
  const ip = getClientIp(request.headers) ?? "unknown"
  const ipLimited = await checkTenantRateLimit(`login-ip:${ip}`, 60, 10)
  if (ipLimited) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent("Too many login attempts. Please try again later.")}`, origin)
    )
  }
  const emailLimited = await checkTenantRateLimit(`login-email:${email.toLowerCase()}`, 20, 5)
  if (emailLimited) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent("Too many login attempts. Please try again later.")}`, origin)
    )
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return NextResponse.redirect(
          new URL(`/auth/login?error=email_not_confirmed&email=${encodeURIComponent(email)}`, origin)
        )
      }
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin)
      )
    }

    if (!data?.session) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=no_session`, origin)
      )
    }

    return NextResponse.redirect(new URL(redirectTo, origin))
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(err instanceof Error ? err.message : "Login failed")}`, origin)
    )
  }
}
