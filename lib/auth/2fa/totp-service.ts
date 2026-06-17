/**
 * TOTP (Time-based One-Time Password) Service
 * Implements RFC 6238 for 2FA verification
 */
import { authenticator } from 'otplib'
import qrcode from 'qrcode'
import {
  TOTPSecret,
  TOTPVerification,
  TOTPOptions,
  TwoFAError,
  TwoFAErrorCode,
} from './types'
import { createHash } from './utils'

// Configure OTP library
authenticator.options = {
  step: 30, // 30-second window
  window: 1, // Allow 1 window before/after
  algorithm: 'sha1',
  digits: 6,
}

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(options: TOTPOptions = { issuer: 'DigiT', accountName: '' }): TOTPSecret {
  const secret = authenticator.generateSecret()
  
  // Create OTP auth URI
  const issuer = encodeURIComponent(options.issuer)
  const accountName = encodeURIComponent(options.accountName || 'user')
  const uri = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}`
  
  // Generate QR code as data URL
  const qrCode = qrcode.toDataURL(uri)
  
  return {
    secret,
    uri,
    qrCode,
  }
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(secret: string, code: string): TOTPVerification {
  try {
    const isValid = authenticator.check(code, secret)
    
    if (isValid) {
      // Calculate delta (time difference)
      const token = authenticator.token(secret)
      const delta = authenticator.timeUsed()
      
      return { valid: true, delta }
    }
    
    return { valid: false }
  } catch {
    return { valid: false }
  }
}

/**
 * Verify TOTP code with custom options
 */
export function verifyTOTPCodeWithOptions(
  secret: string,
  code: string,
  options?: {
    window?: number
    algorithm?: 'sha1' | 'sha256' | 'sha512'
    step?: number
  }
): TOTPVerification {
  const originalOptions = authenticator.options
  
  try {
    if (options) {
      authenticator.options = {
        ...authenticator.options,
        ...options,
      }
    }
    
    const isValid = authenticator.check(code, secret)
    const delta = isValid ? authenticator.timeUsed() : undefined
    
    return { valid: isValid, delta }
  } finally {
    authenticator.options = originalOptions
  }
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10, length: number = 10): string[] {
  const codes: string[] = []
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding similar characters
  
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

export function generateTOTPSetup(
  issuer: string,
  accountName: string,
  backupCodeOptions?: { count?: number; length?: number }
): TOTPSetupResponse {
  const { secret, uri, qrCode } = generateTOTPSecret({ issuer, accountName })
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
    lockoutDuration: number = 15 * 60 * 1000, // 15 minutes
    windowMs: number = 5 * 60 * 1000 // 5 minutes
  ) {
    this.maxAttempts = maxAttempts
    this.lockoutDuration = lockoutDuration
    this.windowMs = windowMs
  }

  /**
   * Check if user can attempt 2FA verification
   */
  canAttempt(userId: string): { allowed: boolean; remainingAttempts: number; lockedUntil?: Date } {
    const now = Date.now()
    const userRecord = this.attempts.get(userId)
    
    if (userRecord) {
      // Check if user is locked out
      if (userRecord.lockedUntil && now < userRecord.lockedUntil) {
        return {
          allowed: false,
          remainingAttempts: 0,
          lockedUntil: new Date(userRecord.lockedUntil),
        }
      }
      
      // Reset if window has passed
      if (now - userRecord.lastAttempt > this.windowMs) {
        this.attempts.delete(userId)
        return { allowed: true, remainingAttempts: this.maxAttempts }
      }
      
      // Check remaining attempts
      if (userRecord.count >= this.maxAttempts) {
        // Lock out the user
        const lockedUntil = now + this.lockoutDuration
        this.attempts.set(userId, {
          count: userRecord.count + 1,
          lastAttempt: now,
          lockedUntil,
        })
        
        return {
          allowed: false,
          remainingAttempts: 0,
          lockedUntil: new Date(lockedUntil),
        }
      }
      
      return {
        allowed: true,
        remainingAttempts: this.maxAttempts - userRecord.count,
      }
    }
    
    return { allowed: true, remainingAttempts: this.maxAttempts }
  }

  /**
   * Record a failed attempt
   */
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
      this.attempts.set(userId, {
        count: 1,
        lastAttempt: now,
      })
    }
  }

  /**
   * Clear attempts for a user (e.g., after successful verification)
   */
  clearAttempts(userId: string): void {
    this.attempts.delete(userId)
  }

  /**
   * Get rate limit status for a user
   */
  getStatus(userId: string): TwoFARateLimit {
    const userRecord = this.attempts.get(userId)
    
    if (!userRecord) {
      return {
        attempts: 0,
        lastAttempt: new Date(0),
      }
    }
    
    return {
      attempts: userRecord.count,
      lastAttempt: new Date(userRecord.lastAttempt),
      lockedUntil: userRecord.lockedUntil ? new Date(userRecord.lockedUntil) : undefined,
    }
  }
}

/**
 * Singleton rate limiter instance
 */
export const twoFARateLimiter = new TwoFARateLimiter()
