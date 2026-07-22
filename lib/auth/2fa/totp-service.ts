/**
 * TOTP (Time-based One-Time Password) Service
 * Implements RFC 6238 for 2FA verification
 * Uses speakeasy (pure Node.js crypto)
 */
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import { timingSafeEqual } from 'crypto'
import {
  TOTPSecret,
  TOTPVerification,
  TOTPOptions,
} from './types'
import { createHash } from './utils'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'

// TOTP options
const TOTP_OPTIONS = {
  algorithm: 'sha1',
  digits: 6,
  step: 30,
  window: 1,
}

/**
 * Generate a new TOTP secret
 */
export async function generateTOTPSecret(options: TOTPOptions = { issuer: 'DigiT', accountName: '' }): Promise<TOTPSecret> {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${options.issuer}:${options.accountName || 'user'}`,
    issuer: options.issuer,
  })
  
  const uri = secret.otpauth_url || `otpauth://totp/${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.accountName || 'user')}?secret=${secret.base32}&issuer=${encodeURIComponent(options.issuer)}`
  
  const qrCode = await qrcode.toDataURL(uri)
  
  return {
    secret: secret.base32,
    uri,
    qrCode,
  }
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(secret: string, code: string): TOTPVerification {
  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: TOTP_OPTIONS.window,
      step: TOTP_OPTIONS.step,
      algorithm: TOTP_OPTIONS.algorithm,
      digits: TOTP_OPTIONS.digits,
    })
    
    if (verified) {
      // Calculate delta (time difference in steps)
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        step: TOTP_OPTIONS.step,
        algorithm: TOTP_OPTIONS.algorithm,
        digits: TOTP_OPTIONS.digits,
      })
      
      // Get current time and calculate delta
      const now = Math.floor(Date.now() / 1000)
      const currentStep = Math.floor(now / TOTP_OPTIONS.step)
      const tokenTime = currentStep * TOTP_OPTIONS.step
      const delta = now - tokenTime
      
      return { valid: true, delta }
    }
    
    return { valid: false }
  } catch {
    return { valid: false }
  }
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10, length: number = 10): string[] {
  const codes: string[] = []
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  
  for (let i = 0; i < count; i++) {
    let code = ''
    for (let j = 0; j < length; j++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    codes.push(code)
  }
  
  return codes
}

/**
 * Hash backup code for storage
 */
export function hashBackupCode(code: string): string {
  return createHash(code, 'sha256')
}

/**
 * Verify backup code
 */
export function verifyBackupCode(code: string, hashedCode: string): boolean {
  const computed = Buffer.from(hashBackupCode(code), 'hex')
  const stored = Buffer.from(hashedCode, 'hex')

  // Buffers of different lengths would make timingSafeEqual throw; treat
  // that as "not a match" rather than leaking length info via an exception.
  if (computed.length !== stored.length) {
    return false
  }

  return timingSafeEqual(computed, stored)
}

/**
 * Generate a TOTP setup response
 */
export interface TOTPSetupResponse {
  secret: string
  uri: string
  qrCode: string
  backupCodes: string[]
  hashedBackupCodes: string[]
}

export async function generateTOTPSetup(
  issuer: string,
  accountName: string,
  backupCodeOptions?: { count?: number; length?: number }
): Promise<TOTPSetupResponse> {
  const { secret, uri, qrCode } = await generateTOTPSecret({ issuer, accountName })
  const backupCodes = generateBackupCodes(
    backupCodeOptions?.count || 10,
    backupCodeOptions?.length || 10
  )
  const hashedBackupCodes = backupCodes.map(hashBackupCode)
  
  return {
    secret,
    uri,
    qrCode,
    backupCodes,
    hashedBackupCodes,
  }
}

/**
 * Verify 2FA code (TOTP or backup code)
 */
export function verify2FACode(
  code: string,
  secret: string,
  hashedBackupCodes: string[] = []
): { valid: boolean; isBackupCode: boolean; backupCodeIndex?: number } {
  // Try TOTP first
  if (verifyTOTPCode(secret, code).valid) {
    return { valid: true, isBackupCode: false }
  }
  
  // Try backup codes
  for (let i = 0; i < hashedBackupCodes.length; i++) {
    if (verifyBackupCode(code, hashedBackupCodes[i])) {
      return { valid: true, isBackupCode: true, backupCodeIndex: i }
    }
  }
  
  return { valid: false, isBackupCode: false }
}

/**
 * Rate limiting for 2FA attempts
 * Prevents brute force attacks.
 *
 * This used to be an in-process `Map` (TwoFARateLimiter), which reset on
 * every deploy/restart and wasn't shared across serverless instances --
 * an attacker could retry indefinitely just by hitting a fresh instance.
 * Every other auth-sensitive endpoint (login, signup, forgot-password,
 * passwordless) already rate-limits through the Redis-backed
 * `checkTenantRateLimit` (lib/multitenant/rate-limit.ts), so 2FA now goes
 * through the same distributed limiter.
 *
 * That helper only exposes fixed 1-minute / 1-hour sliding windows (no
 * custom 5-minute window, and no separate "lockout" state), so the
 * original 5-attempts-per-5-minutes-then-15-minute-lockout policy is
 * approximated as the closest equivalent it can express: at most 5
 * attempts per rolling minute AND at most 5 attempts per rolling hour.
 * The hourly cap is what actually enforces the lockout here -- once 5
 * attempts are made, the caller is blocked for up to an hour (stricter
 * than the original 15-minute lockout, but the same order of magnitude,
 * and consistently enforced across all instances instead of per-process).
 */
export async function checkTwoFARateLimit(userId: string) {
  return checkTenantRateLimit(`2fa:${userId}`, 5, 5)
}
