"use server"

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { verifyRegistrationResponse, type RegistrationResponseJSON, type AuthenticatorAttestationResponseJSON } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"

export async function POST(request: Request) {
  const { credential, email } = await request.json()

  if (!credential || !email) {
    return NextResponse.json(
      { error: "Credential and email are required" },
      { status: 400 }
    )
  }

  // Convert credential to expected format
  const registrationResponse: RegistrationResponseJSON = {
    id: credential.id,
    rawId: credential.rawId,
    response: credential.response,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.clientExtensionResults || {},
    type: credential.type,
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

    // Get challenge from session
    const { data: challengeRecord } = await db
      .from("webauthn_challenges")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!challengeRecord) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      )
    }

    // Verify registration
  const verification = await verifyRegistrationResponse({
    response: registrationResponse,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    expectedRPID: process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost",
  })

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Device registration failed" },
        { status: 400 }
      )
    }

    const registrationInfo = verification.registrationInfo
    if (!registrationInfo) {
      return NextResponse.json(
        { error: "Device registration failed - no registration info" },
        { status: 400 }
      )
    }

    if (!registrationInfo.credential || !registrationInfo.credential.id || !registrationInfo.credential.publicKey || registrationInfo.credential.counter === undefined) {
      return NextResponse.json(
        { error: "Invalid device registration data" },
        { status: 400 }
      )
    }
    const credentialData = registrationInfo.credential

    // Store credential
    await db.from("user_devices").insert({
      user_id: user.id,
      credential_id: credentialData.id,
      public_key: isoBase64URL.fromBuffer(credentialData.publicKey),
      counter: credentialData.counter,
      device_type: "platform",
      transports: credentialData.transports || [],
    })

    // Clean up challenge
    await db.from("webauthn_challenges").delete().eq("id", challengeRecord.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to verify device" },
      { status: 500 }
    )
  }
}