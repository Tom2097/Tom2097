/**
 * Two-Factor Authentication Types
 */

export interface TOTPSecret {
  secret: string
  uri: string
  qrCode: string
}

export interface TOTPVerification {
  valid: boolean
  delta?: number
}

export interface BackupCode {
  code: string
  used: boolean
  createdAt: Date
}

export interface User2FASettings {
  id: string
  userId: string
  method: 'totp' | 'email' | 'sms' | 'webauthn'
  enabled: boolean
  verified: boolean
  secret?: string // Encrypted TOTP secret
  backupCodes?: string[] // Hashed backup codes
  phoneNumber?: string // For SMS
  email?: string // For email fallback
  webauthnCredentials?: Record<string, unknown> // For WebAuthn
  createdAt: Date
  updatedAt: Date
  lastUsedAt?: Date
}

export interface TOTPOptions {
  issuer: string
  accountName: string
  algorithm?: 'sha1' | 'sha256' | 'sha512'
  digits?: number
  period?: number
}

export interface Verify2FACodeOptions {
  code: string
  userId: string
  method?: 'totp' | 'email' | 'sms'
}

export interface GenerateBackupCodesOptions {
  count?: number
  length?: number
}

export class TwoFAError extends Error {
  constructor(
    message: string,
    public readonly code: TwoFAErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'TwoFAError'
  }
}

export enum TwoFAErrorCode {
  INVALID_CODE = 'INVALID_CODE',
  EXPIRED_CODE = 'EXPIRED_CODE',
  MAX_ATTEMPTS = 'MAX_ATTEMPTS',
  NOT_ENABLED = 'NOT_ENABLED',
  NOT_VERIFIED = 'NOT_VERIFIED',
  BACKUP_CODE_USED = 'BACKUP_CODE_USED',
  NO_BACKUP_CODES = 'NO_BACKUP_CODES',
  METHOD_NOT_CONFIGURED = 'METHOD_NOT_CONFIGURED',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Rate limiting for 2FA attempts
 */
export interface TwoFARateLimit {
  attempts: number
  lastAttempt: Date
  lockedUntil?: Date
}
