/**
 * TOTP (Time-based One-Time Password) Service
 * Implements RFC 6238 for 2FA verification
 * Uses speakeasy (pure Node.js crypto)
 */
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import {
  TOTPSecret,
  TOTPVerification,
  TOTPOptions,
} from './types'
import { createHash } from './utils'

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
  return hashBackupCode(code) === hashedCode
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
 * Prevents brute force attacks
 */
export class TwoFARateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map()
  private maxAttempts: number
  private lockoutDuration: number
  private windowMs: number

  constructor(
    maxAttempts: number = 5,
    lockoutDuration: number = 15 * 60 * 1000,
    windowMs: number = 5 * 60 * 1000
  ) {
    this.maxAttempts = maxAttempts
    this.lockoutDuration = lockoutDuration
    this.windowMs = windowMs
  }

  canAttempt(userId: string): { allowed: boolean; remainingAttempts: number; lockedUntil?: Date } {
    const now = Date.now()
    const userRecord = this.attempts.get(userId)
    
    if (userRecord) {
      if (userRecord.lockedUntil && now < userRecord.lockedUntil) {
        return {
          allowed: false,
          remainingAttempts: 0,
          lockedUntil: new Date(userRecord.lockedUntil),
        }
      }
      
      if (now - userRecord.lastAttempt > this.windowMs) {
        this.attempts.delete(userId)
        return { allowed: true, remainingAttempts: this.maxAttempts }
      }
      
      if (userRecord.count >= this.maxAttempts) {
        const lockedUntil = now + this.lockoutDuration
        this.attempts.set(userId, {
          count: userRecord.count + 1,
          lastAttempt: now,
          lockedUntil,
        })
        return { allowed: false, remainingAttempts: 0, lockedUntil: new Date(lockedUntil) }
      }
      
      return { allowed: true, remainingAttempts: this.maxAttempts - userRecord.count }
    }
    
    return { allowed: true, remainingAttempts: this.maxAttempts }
  }

  recordAttempt(userId: string): void {
    const now = Date.now()
    const userRecord = this.attempts.get(userId)
    
    if (userRecord) {
      this.attempts.set(userId, {
        count: userRecord.count + 1,
        lastAttempt: now,
        lockedUntil: userRecord.lockedUntil,
      })
    } else {
      this.attempts.set(userId, { count: 1, lastAttempt: now })
    }
  }

  clearAttempts(userId: string): void {
    this.attempts.delete(userId)
  }

  getStatus(userId: string): { attempts: number; lastAttempt: Date; lockedUntil?: Date } {
    const userRecord = this.attempts.get(userId)
    if (!userRecord) {
      return { attempts: 0, lastAttempt: new Date(0) }
    }
    return {
      attempts: userRecord.count,
      lastAttempt: new Date(userRecord.lastAttempt),
      lockedUntil: userRecord.lockedUntil ? new Date(userRecord.lockedUntil) : undefined,
    }
  }
}

export const twoFARateLimiter = new TwoFARateLimiter()
