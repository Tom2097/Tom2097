import { NextRequest, NextResponse } from "next/server"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const { action, data } = await req.json()

    if (action === "start-registration") {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }

      // Generate registration options
      const options = await generateRegistrationOptions({
        rpID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "localhost:3000",
        rpName: "DigiT",
        userName: user.email || user.id,
        userID: Buffer.from(user.id),
        userDisplayName: user.user_metadata?.full_name || user.email || "User",
      })

      // Store challenge in session/database temporarily
      // For now, we'll return it and expect it back in verification
      return NextResponse.json({
        options,
        challenge: options.challenge,
      })
    }

    if (action === "verify-registration") {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }

      const { credential, challenge, deviceName } = data

      try {
        // Verify the credential
        const verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge: challenge,
          expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          expectedRPID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "localhost:3000",
        })

        if (!verification.verified || !verification.registrationInfo) {
          return NextResponse.json(
            { error: "Verification failed" },
            { status: 400 }
          )
        }

        // Store passkey in database
        const { credential: registeredCredential } =
          verification.registrationInfo
        const credentialID = registeredCredential.id
        const publicKey = Buffer.from(
          registeredCredential.publicKey
        ).toString("base64")

        const { data: passkey, error } = await supabase
          .from("passkeys")
          .insert({
            user_id: user.id,
            credential_id: credentialID,
            public_key: publicKey,
            counter: registeredCredential.counter,
            device_name: deviceName || "Unknown Device",
            transports: credential.response?.transports || [],
          })
          .select()
          .single()

        if (error) {
          return NextResponse.json(
            { error: `Failed to save passkey: ${error.message}` },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          passkey,
          message: "Passkey registered successfully",
        })
      } catch (err: any) {
        return NextResponse.json(
          { error: `Verification error: ${err.message}` },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    )
  }
}
