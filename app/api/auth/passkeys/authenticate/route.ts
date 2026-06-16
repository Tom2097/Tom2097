import { NextRequest, NextResponse } from "next/server"
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(req: NextRequest) {
  try {
    const { action, data } = await req.json()

    if (action === "start-authentication") {
      const options = await generateAuthenticationOptions({
        rpID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "localhost:3000",
      })

      return NextResponse.json({
        options,
        challenge: options.challenge,
      })
    }

    if (action === "verify-authentication") {
      const { credential, challenge, credentialID } = data

      try {
        const supabase = await createClient()
        // Passkey lookups happen BEFORE the user has a session, so RLS would
        // hide the row. Use the service client (RLS-exempt) for the credential
        // table; possession of the credential + the verified WebAuthn signature
        // is the proof, not an active session.
        const db = createServiceClient()

        // Get passkey from database
        const { data: passkey, error: passkeyError } = await db
          .from("passkeys")
          .select("*")
          .eq("credential_id", credentialID)
          .single()

        if (passkeyError || !passkey) {
          return NextResponse.json(
            { error: "Passkey not found" },
            { status: 404 }
          )
        }

        // Verify authentication
        const verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge: challenge,
          expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          expectedRPID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "localhost:3000",
          credential: {
            id: credentialID,
            publicKey: Buffer.from(passkey.public_key, "base64"),
            counter: passkey.counter,
            transports: passkey.transports || [],
          },
        })

        if (!verification.verified) {
          return NextResponse.json(
            { error: "Verification failed" },
            { status: 400 }
          )
        }

        // Update counter and last_used_at
        const { error: updateError } = await db
          .from("passkeys")
          .update({
            counter: verification.authenticationInfo?.newCounter || passkey.counter,
            last_used_at: new Date().toISOString(),
          })
          .eq("credential_id", credentialID)

        if (updateError) {
          console.error("Failed to update passkey counter:", updateError)
        }

        // Sign in the user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          // Get user from the passkey association
          const { data: userData, error: getUserError } = await db
            .from("passkeys")
            .select("user_id")
            .eq("credential_id", credentialID)
            .single()

          if (getUserError || !userData) {
            return NextResponse.json(
              { error: "User not found" },
              { status: 404 }
            )
          }

          // Return success - client will handle redirect
          return NextResponse.json({
            success: true,
            userId: userData.user_id,
            message: "Passkey authenticated successfully",
          })
        }

        return NextResponse.json({
          success: true,
          userId: passkey.user_id,
          message: "Passkey authenticated successfully",
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
