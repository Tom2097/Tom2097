import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || ""

  let email: string
  let password: string
  let redirectTo = "/login-check"

  if (contentType.includes("application/json")) {
    const body = await request.json()
    email = body.email
    password = body.password
    if (body.redirect) redirectTo = body.redirect
  } else {
    const formData = await request.formData()
    email = formData.get("email") as string
    password = formData.get("password") as string
    redirectTo = (formData.get("redirect") as string) || "/login-check"
  }

  if (!email || !password) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent("Email and password required")}`, request.url)
    )
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return new Response(`LOGIN FAILED: ${error.message}`, {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      })
    }

    if (!data?.session) {
      return new Response("LOGIN FAILED: no session returned", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      })
    }

    return new Response(`LOGIN OK user=${data.user.email} id=${data.user.id}`, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  } catch (err) {
    return new Response(`LOGIN ERROR: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    })
  }
}
