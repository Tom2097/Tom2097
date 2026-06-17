/**
 * Passwordless Authentication Types
 */

export interface MagicLinkToken {
  token: string
  userId: string
  email: string
  expiresAt: Date
  used: boolean
  usedAt?: Date
  ipAddress?: string
  userAgent?: string
  redirectTo?: string
}

export interface MagicLinkOptions {
  email: string
  redirectTo?: string
  expiresIn?: number // minutes
  customSubject?: string
  customMessage?: string
}

export interface MagicLinkEmailContent {
  to: string
  subject: string
  html: string
  text: string
}

export interface PasswordlessSession {
  id: string
  userId: string
  email: string
  token: string
  expiresAt: Date
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface VerifyMagicLinkOptions {
  token: string
  ipAddress?: string
  userAgent?: string
}

export class PasswordlessError extends Error {
  constructor(
    message: string,
    public readonly code: PasswordlessErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'PasswordlessError'
  }
}

export enum PasswordlessErrorCode {
  INVALID_EMAIL = 'INVALID_EMAIL',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_USED = 'TOKEN_USED',
  RATE_LIMITED = 'RATE_LIMITED',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PASSWORDLESS_DISABLED = 'PASSWORDLESS_DISABLED',
}

/**
 * Magic link configuration
 */
export interface PasswordlessConfig {
  /** Token expiration in minutes */
  tokenExpiration: number
  /** Maximum tokens per email per hour */
  maxTokensPerHour: number
  /** Rate limit window in minutes */
  rateLimitWindow: number
  /** Enable passwordless authentication */
  enabled: boolean
  /** Email subject template */
  emailSubject: string
  /** Email template (HTML) */
  emailTemplate: string
  /** From email address */
  fromEmail: string
}

export const DEFAULT_PASSWORDLESS_CONFIG: PasswordlessConfig = {
  tokenExpiration: 15, // 15 minutes
  maxTokensPerHour: 5,
  rateLimitWindow: 60, // 1 hour
  enabled: true,
  emailSubject: 'Your DigiT Login Link',
  emailTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login to DigiT</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #2563eb;">DigiT</h1>
    <p>Hello,</p>
    <p>You requested a login link for your DigiT account. Click the button below to sign in:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{loginUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        Sign In
      </a>
    </p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>This link will expire in {{expirationMinutes}} minutes.</p>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      DigiT Enterprise Platform
    </p>
  </div>
</body>
</html>`,
  fromEmail: 'noreply@digit.app',
}
