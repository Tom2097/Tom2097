"use server"

import { NextResponse } from "next/server"
import { verifyMagicLink } from "@/lib/auth/passwordless/service"
import { createServiceClient } from "@/lib/supabase/service"
import { hashToken } from "@/lib/auth/passwordless/service"

export async function POST(request: Request) {
  const { email, passcode } = await request.json()

  if (!email || !passcode) {
    return NextResponse.json(
      { error: "Email and passcode are required" },
      { status: 400 }
    )
  }

  const db = createServiceClient()
  const tokenHash = hashToken(passcode)

  try {
    const { data: record } = await db
      .from("magic_link_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .maybeSingle()

    if (!record) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 404 }
      )
    }

    const expiresAt = new Date(record.expires_at as string)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Passcode expired" },
        { status: 400 }
      )
    }

    await db.from("magic_link_tokens").update({ used: true, used_at: new Date().toISOString() }).eq("id", record.id)

    return NextResponse.json({ success: true, userId: record.user_id })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to verify passcode" },
      { status: 500 }
    )
  }
}