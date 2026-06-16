import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"

  const buildRedirect = (path: string) => {
    const forwardedHost = request.headers.get("x-forwarded-host")
    const isLocalEnv = process.env.NODE_ENV === "development"
    if (!isLocalEnv && forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${path}`)
    }
    return NextResponse.redirect(`${origin}${path}`)
  }

  const supabase = await createClient()
  const db = createServiceClient()

  // PKCE flow: exchange the auth code for a session
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Session created successfully — now ensure the user has a profile and organization
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        try {
          // Check if profile already exists
          const { data: existingProfile } = await db
            .from("profiles")
            .select("id, organization_id")
            .eq("id", user.id)
            .maybeSingle()

          if (!existingProfile) {
            // No profile yet — create organization and profile
            const { data: org, error: orgError } = await db
              .from("organizations")
              .insert({
                name: (user.user_metadata?.company_name || user.email?.split("@")[0]) as string,
                slug: `org-${user.id.slice(0, 8)}`,
              })
              .select("id")
              .single()

            if (orgError || !org) {
              console.error("[auth] Failed to create organization:", orgError)
              return buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create organization")}`)
            }

            // Create profile
            const { error: profileError } = await db
              .from("profiles")
              .insert({
                id: user.id,
                email: user.email,
                full_name: (user.user_metadata?.full_name || "") as string,
                organization_id: org.id,
                role: "admin", // First user is always admin
              })

            if (profileError) {
              console.error("[auth] Failed to create profile:", profileError)
              return buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create profile")}`)
            }

            // Create subscription (so they have an org entry)
            const { error: subError } = await db
              .from("subscriptions")
              .insert({
                organization_id: org.id,
                plan_id: "free",
                status: "incomplete",
              })

            if (subError) {
              console.error("[auth] Failed to create subscription:", subError)
              // Don't fail signup for this — subscription can be created on-demand
            }
          }
        } catch (err) {
          console.error("[auth] Post-signup profile creation failed:", err)
          // Don't block login — user can still proceed, profile issue can be fixed later
        }
      }

      return buildRedirect(next)
    }
    console.log("[v0] exchangeCodeForSession failed:", error.message)
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  // OTP / magic-link flow: verify the token hash
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      // Same profile creation logic for OTP flow
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        try {
          const { data: existingProfile } = await db
            .from("profiles")
            .select("id, organization_id")
            .eq("id", user.id)
            .maybeSingle()

          if (!existingProfile) {
            const { data: org, error: orgError } = await db
              .from("organizations")
              .insert({
                name: (user.user_metadata?.company_name || user.email?.split("@")[0]) as string,
                slug: `org-${user.id.slice(0, 8)}`,
              })
              .select("id")
              .single()

            if (orgError || !org) {
              return buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create organization")}`)
            }

            const { error: profileError } = await db
              .from("profiles")
              .insert({
                id: user.id,
                email: user.email,
                full_name: (user.user_metadata?.full_name || "") as string,
                organization_id: org.id,
                role: "admin",
              })

            if (profileError) {
              return buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create profile")}`)
            }

            const { error: subError } = await db
              .from("subscriptions")
              .insert({
                organization_id: org.id,
                plan_id: "free",
                status: "incomplete",
              })

            if (subError) {
              console.error("[auth] Failed to create subscription in OTP flow:", subError)
            }
          }
        } catch (err) {
          console.error("[auth] Post-OTP profile creation failed:", err)
        }
      }

      return buildRedirect(next)
    }
    console.log("[v0] verifyOtp failed:", error.message)
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  // No code or token present — nothing to verify
  return buildRedirect("/auth/error?reason=missing_verification_token")
}
