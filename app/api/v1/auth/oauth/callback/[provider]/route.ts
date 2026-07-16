import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRequestOrigin } from "@/lib/http/request-origin"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const origin = getRequestOrigin(request)
  try {
    const { provider } = await params
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const errorParam = url.searchParams.get("error")

    if (errorParam) {
      return NextResponse.redirect(new URL("/auth/login?error=oauth_denied", origin))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/auth/login?error=missing_code", origin))
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", origin))
    }

    return NextResponse.redirect(new URL("/dashboard", origin))
  } catch (err) {
    console.error("[oauth] Callback error:", err)
    return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", origin))
  }
}
