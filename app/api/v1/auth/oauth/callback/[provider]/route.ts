import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const errorParam = url.searchParams.get("error")

    if (errorParam) {
      return NextResponse.redirect(new URL("/auth/login?error=oauth_denied", request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/auth/login?error=missing_code", request.url))
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", request.url))
    }

    return NextResponse.redirect(new URL("/dashboard", request.url))
  } catch (err) {
    console.error("[oauth] Callback error:", err)
    return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", request.url))
  }
}
