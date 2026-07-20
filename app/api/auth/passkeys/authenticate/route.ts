import { NextRequest, NextResponse } from "next/server"
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server"
import type { AuthenticationResponseJSON } from "@simplewebauthn/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

const CHALLENGE_COOKIE = "digit_passkey_auth_flow"
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
    path: "/api/auth/passkeys/authenticate",
    maxAge: 0,
  })
  return response
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action?: "options" | "verify"
      credential?: AuthenticationResponseJSON
    }
    const db = createServiceClient()
    const { origin, rpID } = webAuthnConfig()

    if (body.action === "options") {
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
      })
      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()
      const { data: flow, error } = await db
        .from("passkey_authentication_challenges")
        .insert({ challenge: options.challenge, expires_at: expiresAt })
        .select("id")
        .single()

      if (error || !flow) {
        return NextResponse.json({ error: "Unable to start passkey authentication" }, { status: 503 })
      }

      const response = NextResponse.json(options)
      response.cookies.set(CHALLENGE_COOKIE, flow.id, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth/passkeys/authenticate",
        maxAge: CHALLENGE_TTL_MS / 1000,
      })
      return response
    }

    if (body.action === "verify") {
      const credential = body.credential
      const flowId = req.cookies.get(CHALLENGE_COOKIE)?.value
      if (!credential || !flowId) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Passkey challenge is missing or expired" }, { status: 400 })
        )
      }

      // Delete-and-return consumes the challenge before verification. Only
      // one concurrent request can receive it, preventing assertion replay.
      const { data: flow, error: flowError } = await db
        .from("passkey_authentication_challenges")
        .delete()
        .eq("id", flowId)
        .gt("expires_at", new Date().toISOString())
        .select("challenge")
        .maybeSingle()

      if (flowError || !flow) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Passkey challenge is missing or expired" }, { status: 400 })
        )
      }

      const { data: passkey, error: passkeyError } = await db
        .from("passkeys")
        .select("user_id, credential_id, public_key, counter, transports")
        .eq("credential_id", credential.id)
        .single()

      if (passkeyError || !passkey) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Passkey authentication failed" }, { status: 400 })
        )
      }

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: flow.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credential_id,
          publicKey: Buffer.from(passkey.public_key, "base64"),
          counter: passkey.counter,
          transports: passkey.transports || [],
        },
        requireUserVerification: true,
      })

      if (!verification.verified) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Passkey authentication failed" }, { status: 400 })
        )
      }

      const { data: profile } = await db
        .from("profiles")
        .select("status")
        .eq("id", passkey.user_id)
        .maybeSingle()
      if (profile?.status === "suspended") {
        return clearChallengeCookie(
          NextResponse.json({ error: "Account suspended" }, { status: 403 })
        )
      }

      const { error: updateError } = await db
        .from("passkeys")
        .update({
          counter: verification.authenticationInfo.newCounter ?? passkey.counter,
          last_used_at: new Date().toISOString(),
        })
        .eq("credential_id", passkey.credential_id)
        .eq("user_id", passkey.user_id)

      if (updateError) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Passkey state could not be updated" }, { status: 503 })
        )
      }

      const { data: authUser, error: userError } = await db.auth.admin.getUserById(passkey.user_id)
      if (userError || !authUser.user?.email) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Passkey account is unavailable" }, { status: 400 })
        )
      }

      // Mint a normal Supabase session only after WebAuthn verification. The
      // one-time magic-link token remains server-side and verifyOtp writes the
      // standard SSR auth cookies to this response context.
      const { data: link, error: linkError } = await db.auth.admin.generateLink({
        type: "magiclink",
        email: authUser.user.email,
      })
      const tokenHash = link.properties?.hashed_token
      if (linkError || !tokenHash) {
        return clearChallengeCookie(
          NextResponse.json({ error: "Unable to create authenticated session" }, { status: 503 })
        )
      }

      const supabase = await createClient()
      const { data: session, error: sessionError } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: tokenHash,
      })
      if (sessionError || !session.session || session.user?.id !== passkey.user_id) {
        await supabase.auth.signOut()
        return clearChallengeCookie(
          NextResponse.json({ error: "Unable to create authenticated session" }, { status: 503 })
        )
      }

      return clearChallengeCookie(NextResponse.json({ success: true }))
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: unknown) {
    console.error("[passkey-auth] authentication failed", err)
    return clearChallengeCookie(
      NextResponse.json({ error: "Passkey authentication failed" }, { status: 400 })
    )
  }
}
