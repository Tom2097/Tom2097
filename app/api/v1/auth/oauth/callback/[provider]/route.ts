import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { exchangeCodeForToken, fetchUserProfile, findOrCreateUser } from "@/lib/auth/oauth/service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")

    if (error) {
      return NextResponse.redirect(new URL("/auth/login?error=oauth_denied", request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/auth/login?error=missing_code", request.url))
    }

    const token = await exchangeCodeForToken(provider, code)
    const profile = await fetchUserProfile(provider, token)
    const userId = await findOrCreateUser(profile)

    const supabase = await createServiceClient()
    const { data: session } = await supabase.auth.admin.createSession({
      user_id: userId,
    })
    const sessionCookie = `sb-session=${session?.id || ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`

    const redirectUrl = new URL("/dashboard", request.url)
    const response = NextResponse.redirect(redirectUrl)
    response.headers.set("Set-Cookie", sessionCookie)
    return response
  } catch (err) {
    console.error("[oauth] Callback error:", err)
    return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", request.url))
  }
}
