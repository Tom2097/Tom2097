"use server"

import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server"
import type { RegistrationResponseJSON } from "@simplewebauthn/server"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

const RP_NAME = "DigiT"

function getRpID(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    return new URL(url).hostname
  } catch {
    return "localhost"
  }
}

function getOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}

/** Generates WebAuthn registration options and stores the challenge for later verification. */
export async function createWebAuthnRegistrationOptions(userId: string, email: string) {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpID(),
    userID: Uint8Array.from(Buffer.from(userId, "utf-8")),
    userName: email,
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  })

  const db = createServiceClient()
  const { error } = await db.from("webauthn_challenges").insert({
    email: email.toLowerCase(),
    challenge: options.challenge,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  if (error) {
    logger.logError("[webauthn] Failed to persist registration challenge", { error })
    throw new Error("Failed to persist registration challenge")
  }

  return options
}

/** Verifies a registration response against the challenge this server issued. */
export async function verifyWebAuthnRegistrationResponse(
  email: string,
  response: RegistrationResponseJSON,
): Promise<{ verified: boolean; error?: string; credential?: { id: string; publicKey: string; counter: number } }> {
  const db = createServiceClient()
  const { data: challengeRow } = await db
    .from("webauthn_challenges")
    .select("*")
    .eq("email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
    return { verified: false, error: "Registration challenge expired. Please try again." }
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpID(),
    })

    await db.from("webauthn_challenges").delete().eq("id", challengeRow.id)

    if (!verification.verified || !verification.registrationInfo) {
      return { verified: false, error: "Verification failed" }
    }

    const { credential } = verification.registrationInfo
    return {
      verified: true,
      credential: {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
      },
    }
  } catch (error) {
    logger.logError("[webauthn] Verification error:", { error })
    return { verified: false, error: "Verification failed" }
  }
}

interface RegisterWebAuthnOptions {
  userId: string
  credential: {
    id: string
    publicKey: string
    counter: number
    deviceType: string
    transports?: string[]
  }
  deviceName?: string
}

interface VerifyWebAuthnOptions {
  userId: string
  credentialId: string
}

export async function registerWebAuthnCredential(options: RegisterWebAuthnOptions) {
  const db = createServiceClient()

  try {
    const { error } = await db.from("user_devices").insert({
      user_id: options.userId,
      credential_id: options.credential.id,
      public_key: options.credential.publicKey,
      counter: options.credential.counter,
      device_type: options.credential.deviceType,
      transports: options.credential.transports,
      device_name: options.deviceName || `Device ${new Date().toLocaleString()}`,
      last_used_at: new Date().toISOString(),
    })

    if (error) {
      logger.logError("[webauthn] Failed to save credential", { error })
      return { success: false, error: "Failed to register device" }
    }
    return { success: true }
  } catch (error) {
    logger.logError("[webauthn] Registration failed:", { error })
    return { success: false, error: "Failed to register device" }
  }
}

export async function verifyWebAuthnCredential(options: VerifyWebAuthnOptions) {
  const db = createServiceClient()

  try {
    const { data: credential } = await db
      .from("user_devices")
      .select("*")
      .eq("user_id", options.userId)
      .eq("credential_id", options.credentialId)
      .single()

    if (!credential) {
      return { success: false, error: "Device not found" }
    }

    // Update last used time
    await db.from("user_devices").update({
      last_used_at: new Date().toISOString(),
    }).eq("id", credential.id)

    return { success: true, credential }
  } catch (error) {
    logger.logError("[webauthn] Verification failed:", { error })
    return { success: false, error: "Failed to verify device" }
  }
}

export async function hasWebAuthnCredentials(userId: string) {
  const db = createServiceClient()

  try {
    const { count } = await db
      .from("user_devices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    return { hasCredentials: (count || 0) > 0 }
  } catch (error) {
    logger.logError("[webauthn] Check failed:", { error })
    return { hasCredentials: false }
  }
}

export async function getWebAuthnCredentials(userId: string) {
  const db = createServiceClient()

  try {
    const { data: credentials } = await db
      .from("user_devices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    return { credentials: credentials || [] }
  } catch (error) {
    logger.logError("[webauthn] Fetch failed:", { error })
    return { credentials: [] }
  }
}
