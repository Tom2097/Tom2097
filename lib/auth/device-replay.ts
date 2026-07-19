"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { createHash, randomBytes } from "crypto"

export interface ReplayAttempt {
  id: string
  deviceId: string
  userId?: string
  codeHash?: string
  attemptType: "passcode_reuse" | "invalid_passcode" | "device_mismatch" | "token_replay"
  ipAddress: string
  userAgent: string
  timestamp: string
  blocked: boolean
}

export async function hashPasscode(passcode: string): Promise<string> {
  return createHash("sha256").update(passcode).digest("hex")
}

export async function generateAntiReplayToken(): Promise<string> {
  return randomBytes(32).toString("hex")
}

export async function consumePasscode(
  userId: string,
  passcode: string,
  deviceId: string
): Promise<{ valid: boolean; replayDetected: boolean }> {
  const supabase = await createServiceClient()
  const passcodeHash = await hashPasscode(passcode)

  // Validate against the passcode actually issued to this user (magic_link_tokens,
  // populated by lib/auth/passwordless/service.ts#sendMagicLink). Without this lookup,
  // any never-before-seen string would be accepted since the checks below only guard
  // against *replaying* a previously-consumed value, not against a fabricated one.
  const { data: issued } = await supabase
    .from("magic_link_tokens")
    .select("id, expires_at, used")
    .eq("user_id", userId)
    .eq("token_hash", passcodeHash)
    .maybeSingle()

  if (!issued || issued.used || new Date(issued.expires_at as string) < new Date()) {
    await logReplayAttempt({
      deviceId,
      userId,
      codeHash: passcodeHash,
      attemptType: "invalid_passcode",
      ipAddress: "",
      userAgent: "",
      blocked: true,
    })
    return { valid: false, replayDetected: false }
  }

  // Check if this passcode hash was already used (anti-replay)
  const { data: existing } = await supabase
    .from("consumed_passcodes")
    .select("id, consumed_at, device_id")
    .eq("passcode_hash", passcodeHash)
    .maybeSingle()

  if (existing) {
    // Replay attempt detected
    await logReplayAttempt({
      deviceId,
      userId,
      codeHash: passcodeHash,
      attemptType: "passcode_reuse",
      ipAddress: "",
      userAgent: "",
      blocked: true,
    })
    return { valid: false, replayDetected: true }
  }

  // Mark as consumed
  const { error } = await supabase.from("consumed_passcodes").insert({
    passcode_hash: passcodeHash,
    device_id: deviceId,
    consumed_at: new Date().toISOString(),
  })

  if (error) {
    // Duplicate insert means it was already consumed (race condition)
    return { valid: false, replayDetected: true }
  }

  // Mark the issued token itself as used so it can't be validated again
  await supabase
    .from("magic_link_tokens")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", issued.id as string)

  return { valid: true, replayDetected: false }
}

export async function verifyDeviceBinding(
  userId: string,
  deviceId: string
): Promise<{ bound: boolean; knownDevice: boolean }> {
  const supabase = await createServiceClient()

  // Check if this device is bound to this user
  const { data: device } = await supabase
    .from("user_devices")
    .select("id, credential_id")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .single()

  if (device) {
    // Known device with credential
    return { bound: true, knownDevice: true }
  }

  // Check if device exists but bound to different user
  const { data: otherDevice } = await supabase
    .from("user_devices")
    .select("user_id")
    .eq("device_id", deviceId)
    .single()

  if (otherDevice) {
    // Device bound to different user - possible theft
    await logReplayAttempt({
      deviceId,
      userId,
      attemptType: "device_mismatch",
      ipAddress: "",
      userAgent: "",
      blocked: true,
    })
    return { bound: false, knownDevice: false }
  }

  return { bound: false, knownDevice: false }
}

export async function logReplayAttempt(attempt: {
  deviceId: string
  userId?: string
  codeHash?: string
  attemptType: ReplayAttempt["attemptType"]
  ipAddress: string
  userAgent: string
  blocked?: boolean
}): Promise<void> {
  const supabase = await createServiceClient()

  await supabase.from("replay_attempt_log").insert({
    device_id: attempt.deviceId,
    user_id: attempt.userId,
    code_hash: attempt.codeHash,
    attempt_type: attempt.attemptType,
    ip_address: attempt.ipAddress,
    user_agent: attempt.userAgent,
    timestamp: new Date().toISOString(),
    blocked: attempt.blocked ?? true,
  })
}

export async function getReplayAttempts(
  deviceId: string,
  sinceMinutes: number = 60
): Promise<ReplayAttempt[]> {
  const supabase = await createServiceClient()
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString()

  const { data } = await supabase
    .from("replay_attempt_log")
    .select("*")
    .eq("device_id", deviceId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })

  return ((data as Record<string, unknown>[]) || []).map((a) => ({
    id: a.id as string,
    deviceId: a.device_id as string,
    userId: a.user_id as string | undefined,
    codeHash: a.code_hash as string | undefined,
    attemptType: a.attempt_type as ReplayAttempt["attemptType"],
    ipAddress: a.ip_address as string,
    userAgent: a.user_agent as string,
    timestamp: a.timestamp as string,
    blocked: a.blocked as boolean,
  }))
}

export async function isDeviceRateLimited(deviceId: string): Promise<boolean> {
  const attempts = await getReplayAttempts(deviceId, 15) // last 15 minutes
  const blockThreshold = parseInt(process.env.DEVICE_RATE_LIMIT_THRESHOLD || "5")
  return attempts.filter((a) => a.blocked).length >= blockThreshold
}

export async function getNewDeviceDeadEndConfig() {
  return {
    enabled: process.env.NEW_DEVICE_DEAD_END_ENABLED !== "false",
    maxPasscodeAttempts: parseInt(process.env.MAX_PASSCODE_ATTEMPTS || "3"),
    passcodeCooldownMinutes: parseInt(process.env.PASSCODE_COOLDOWN_MINUTES || "15"),
    deviceRateLimitThreshold: parseInt(process.env.DEVICE_RATE_LIMIT_THRESHOLD || "5"),
    replayMonitoring: true,
    ssoFallbackEnabled: true,
  }
}
