/**
 * Session Utilities
 */
import type { NextRequest } from 'next/server'
import { DeviceInfo } from './types'

/**
 * Simple user agent parser (replaces @simplewebauthn/browser UserAgent)
 */
class SimpleUserAgent {
  private ua: string

  constructor(userAgent: string) {
    this.ua = userAgent.toLowerCase()
  }

  get isMobile(): boolean {
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(this.ua)
  }

  get isTablet(): boolean {
    return /ipad|android(?!.*mobile)|silk|tablet|kindle|playbook/i.test(this.ua)
  }

  get os(): { name: string | null; version?: string } {
    const osList = [
      { name: 'Windows', regex: /windows nt (\d+\.\d+)/, versionIndex: 1 },
      { name: 'Mac OS', regex: /mac os x (\d+[._]\d+)/, versionIndex: 1 },
      { name: 'iOS', regex: /iphone os (\d+_\d+)/, versionIndex: 1 },
      { name: 'Android', regex: /android (\d+\.\d+)/, versionIndex: 1 },
      { name: 'Linux', regex: /linux/, versionIndex: undefined },
    ]

    for (const os of osList) {
      const match = this.ua.match(os.regex)
      if (match) {
        const version = os.versionIndex !== undefined ? match[os.versionIndex]?.replace('_', '.') : undefined
        return { name: os.name, version }
      }
    }

    return { name: null }
  }

  get browser(): { name: string | null; version?: string } {
    const browserList = [
      { name: 'Chrome', regex: /chrome\/([\d.]+)/, versionIndex: 1 },
      { name: 'Firefox', regex: /firefox\/([\d.]+)/, versionIndex: 1 },
      { name: 'Safari', regex: /safari\/([\d.]+)/, versionIndex: 1 },
      { name: 'Edge', regex: /edg\/([\d.]+)/, versionIndex: 1 },
      { name: 'Opera', regex: /opera\/([\d.]+)|opr\/([\d.]+)/, versionIndex: 1 },
      { name: 'IE', regex: /msie (\d+\.\d+)|trident\/.*rv:(\d+\.\d+)/, versionIndex: 1 },
    ]

    for (const browser of browserList) {
      const match = this.ua.match(browser.regex)
      if (match) {
        const version = match[1] || match[2]
        return { name: browser.name, version }
      }
    }

    return { name: null }
  }

  get device(): { model: string | null; type: 'mobile' | 'tablet' | 'desktop' } {
    let type: 'mobile' | 'tablet' | 'desktop' = 'desktop'
    let model: string | null = null

    if (this.isTablet) {
      type = 'tablet'
    } else if (this.isMobile) {
      type = 'mobile'
    }

    // Try to extract device model
    const modelMatch = this.ua.match(/(iphone|ipad|ipod|android|blackberry|playbook|silk)/i)
    if (modelMatch) {
      model = modelMatch[0]
    }

    return { model, type }
  }
}

/**
 * Extract IP address from request
 */
export function extractIP(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  const xRealIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')

  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  if (xRealIP) {
    return xRealIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return request.ip || '0.0.0.0'
}

/**
 * Extract user agent from request
 */
export function extractUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

/**
 * Parse device information from user agent string
 */
export function parseDeviceInfo(userAgent: string): DeviceInfo {
  const ua = new SimpleUserAgent(userAgent)

  // Determine device type
  const deviceInfo = ua.device
  
  return {
    type: deviceInfo.type,
    os: ua.os.name || null,
    browser: ua.browser.name || null,
    model: deviceInfo.model || null,
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2)
  return `${timestamp}-${random}`
}

/**
 * Generate device fingerprint from user agent and IP
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ipAddress: string
): string {
  // Simple hash for demonstration
  // In production, use a proper hashing algorithm
  const input = `${userAgent}:${ipAddress}`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * Check if session is expired
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() >= expiresAt
}

/**
 * Check if session needs refresh (within 5 minutes of expiration)
 */
export function shouldRefreshSession(expiresAt: Date): boolean {
  const now = new Date()
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
  return expiresAt <= fiveMinutesFromNow
}

/**
 * Get location information from IP address
 * Uses free geo-ip services (for demonstration)
 */
export async function getLocationFromIP(ipAddress: string): Promise<{
  country?: string
  city?: string
  region?: string
} | null> {
  // Skip localhost and private IP ranges
  if (
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('172.16.') ||
    ipAddress.startsWith('172.31.')
  ) {
    return null
  }

  try {
    // Use ip-api.com (free, limited to 45 requests per minute from an IP)
    // In production, use a paid service or self-hosted solution
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=country,city,regionName`, {
      method: 'GET',
      headers: {
        'User-Agent': 'DigiT-Session-Service',
      },
      // Cache for 1 hour
      next: { revalidate: 3600 },
    })

    const data = await response.json()

    if (data.status === 'success') {
      return {
        country: data.country,
        city: data.city,
        region: data.regionName,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Create a session token (simplified - use proper JWT in production)
 */
export function createSessionToken(payload: {
  sessionId: string
  userId: string
  organizationId?: string
  expiresIn: number
}): string {
  // This is a simplified token creation
  // In production, use jsonwebtoken or jose library
  const expiresAt = Date.now() + expiresIn * 1000
  const tokenPayload = {
    sessionId: payload.sessionId,
    userId: payload.userId,
    organizationId: payload.organizationId,
    createdAt: Date.now(),
    expiresAt,
  }

  // Base64 encode for demonstration
  // In production, use proper JWT signing with a secret key
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64')
  return encodedPayload
}

/**
 * Decode and verify session token
 */
export function decodeSessionToken(token: string): {
  sessionId: string
  userId: string
  organizationId?: string
  createdAt: number
  expiresAt: number
} | null {
  try {
    // Base64 decode for demonstration
    // In production, use proper JWT verification
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const payload = JSON.parse(decoded)

    // Basic validation
    if (!payload.sessionId || !payload.userId || !payload.expiresAt) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
