"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

interface WebAuthnCredential {
  id: string
  publicKey: string
  counter: number
  deviceType: string
  transports?: string[]
  createdAt: string
  lastUsedAt?: string
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
    await db.from("user_devices").insert({
      user_id: options.userId,
      credential_id: options.credential.id,
      public_key: options.credential.publicKey,
      counter: options.credential.counter,
      device_type: options.credential.deviceType,
      transports: options.credential.transports,
      device_name: options.deviceName || `Device ${new Date().toLocaleString()}`,
      last_used_at: new Date().toISOString(),
    })
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