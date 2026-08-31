"use server"

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    )
  }

  const db = createServiceClient()

  try {
    // Get user by email
    const { data: user } = await db
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single()

    if (!user) {
      return NextResponse.json(
        { hasCredentials: false },
        { status: 200 }
      )
    }

    // Check if user has WebAuthn credentials
    const { count } = await db
      .from("user_devices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    return NextResponse.json(
      { hasCredentials: (count || 0) > 0 },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { hasCredentials: false },
      { status: 200 }
    )
  }
}