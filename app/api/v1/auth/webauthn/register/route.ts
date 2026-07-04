"use server"

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { generateRegistrationOptions } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"

export async function POST(request: Request) {
  const { email } = await request.json()

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
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: "DigiT",
      rpID: process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost",
      userID: user.id,
      userName: email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    })

    // Store challenge in session (in a real app, use a proper session store)
    await db.from("webauthn_challenges").insert({
      user_id: user.id,
      challenge: options.challenge,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    })

    return NextResponse.json(options)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 }
    )
  }
}