import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRequestOrigin } from "@/lib/http/request-origin"

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

  if (!email || !password) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent("Email and password required")}`, origin)
    )
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
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
