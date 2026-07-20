import { NextRequest, NextResponse } from "next/server"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server"
import type { RegistrationResponseJSON } from "@simplewebauthn/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

const CHALLENGE_COOKIE = "digit_passkey_registration_flow"
const CHALLENGE_TTL_MS = 5 * 60 * 1000

function webAuthnConfig() {
  const origin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  )
  return { origin: origin.origin, rpID: origin.hostname }
}

function clearChallengeCookie(response: NextResponse) {
  response.cookies.set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/passkeys/register",
    maxAge: 0,
  })
  return response
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = await req.json() as {
      action?: "start-registration" | "verify-registration"
      data?: { credential?: RegistrationResponseJSON; deviceName?: string }
    }
    const db = createServiceClient()
    const { origin, rpID } = webAuthnConfig()

    if (body.action === "start-registration") {
      const { data: existing } = await db
        .from("passkeys")
        .select("credential_id")
        .eq("user_id", user.id)

      const options = await generateRegistrationOptions({
        rpID,
        rpName: "DigiT",
        userName: user.email || user.id,
        userID: Buffer.from(user.id),
        userDisplayName: user.user_metadata?.full_name || user.email || "User",
        attestationType: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        excludeCredentials: (existing || []).map((passkey) => ({ id: passkey.credential_id })),
      })

      const { data: flow, error } = await db
        .from("passkey_registration_challenges")
        .insert({
          user_id: user.id,
          challenge: options.challenge,
          expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
        })
        .select("id")
        .single()

      if (error || !flow) {
        return NextResponse.json({ error: "Unable to start passkey registration" }, { status: 503 })
      }

      const response = NextResponse.json({ options })
      response.cookies.set(CHALLENGE_COOKIE, flow.id, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth/passkeys/register",
        maxAge: CHALLENGE_TTL_MS / 1000,
      })
      return response
    }

    if (body.action === "verify-registration") {
      const credential = body.data?.credential
      const flowId = req.cookies.get(CHALLENGE_COOKIE)?.value
      if (!credential || !flowId) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Registration challenge is missing or expired" }, { status: 400 })
        )
      }

      // Consume the challenge atomically and bind it to the current session
      // user. A different account cannot finish another account's ceremony.
      const { data: flow, error: flowError } = await db
        .from("passkey_registration_challenges")
        .delete()
        .eq("id", flowId)
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .select("challenge")
        .maybeSingle()

      if (flowError || !flow) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Registration challenge is missing or expired" }, { status: 400 })
        )
      }

      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: flow.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      })

      if (!verification.verified || !verification.registrationInfo) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Passkey registration failed" }, { status: 400 })
        )
      }

      const { credential: registeredCredential } = verification.registrationInfo
      const { data: passkey, error } = await db
        .from("passkeys")
        .insert({
          user_id: user.id,
          credential_id: registeredCredential.id,
          public_key: Buffer.from(registeredCredential.publicKey).toString("base64"),
          counter: registeredCredential.counter,
          device_name: body.data?.deviceName?.trim().slice(0, 100) || "Unknown Device",
          transports: credential.response.transports || [],
        })
        .select("id, device_name, created_at")
        .single()

      if (error || !passkey) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Unable to save passkey" }, { status: 409 })
        )
      }

      return clearChallengeCookie(NextResponse.json({
        success: true,
        passkey,
        message: "Passkey registered successfully",
      }))
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Suspended"].includes(error.message)) {
      return handleAuthError(error)
    }
    console.error("[passkey-registration] registration failed", error)
    return clearChallengeCookie(
      NextResponse.json({ error: "Passkey registration failed" }, { status: 400 })
    )
  }
}
