/**
 * 2FA Utility Functions
 */
import { createHash as cryptoCreateHash } from 'crypto'

/**
 * Create a secure hash using SHA-256
 */
export function createHash(input: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  const hash = cryptoCreateHash(algorithm)
  hash.update(input)
  return hash.digest('hex')
}

/**
 * Generate a random string for secrets
 */
export function generateRandomString(length: number = 32): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const bytes = require('crypto').randomBytes(length)
  
  for (let i = 0; i < length; i++) {
    result += characters[bytes[i] % characters.length]
  }
  
  return result
}

/**
 * Generate a numeric code of specified length
 */
export function generateNumericCode(length: number = 6): string {
  const digits = '0123456789'
  let code = ''
  const bytes = require('crypto').randomBytes(length)
  
  for (let i = 0; i < length; i++) {
    code += digits[bytes[i] % 10]
  }
  
  return code
}

/**
 * Format phone number for SMS
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')
  
  // Add country code if missing (assuming US)
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`
  }
  
  // If already has country code
  if (digitsOnly.startsWith('+')) {
    return digitsOnly
  }
  
  return `+${digitsOnly}`
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digitsOnly = phone.replace(/\D/g, '')
  return digitsOnly.length >= 10
}

/**
 * Mask sensitive data (for logging)
 */
export function maskSensitiveData(data: string, showLast: number = 4): string {
  if (data.length <= showLast) {
    return '*'.repeat(data.length)
  }
  return '*'.repeat(data.length - showLast) + data.slice(-showLast)
}

/**
 * Generate a nonce for OAuth state
 */
export function generateNonce(): string {
  return generateRandomString(32)
}

/**
 * Generate a state token for OAuth
 */
export function generateStateToken(): string {
  return generateRandomString(48)
}
