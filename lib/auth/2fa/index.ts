/**
 * Two-Factor Authentication Module
 * Exports all 2FA-related functionality
 */

export * from './types'
export * from './totp-service'
export * from './utils'

// Re-export main functions
import { generateTOTPSecret, verifyTOTPCode, generateTOTPSetup, verify2FACode } from './totp-service'
import { checkTwoFARateLimit } from './totp-service'
import { TwoFAError, TwoFAErrorCode } from './types'

export { generateTOTPSecret, verifyTOTPCode, generateTOTPSetup, verify2FACode, checkTwoFARateLimit, TwoFAError, TwoFAErrorCode }
