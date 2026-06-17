/**
 * Session Management Types
 */

export interface UserSession {
  id: string
  userId: string
  organizationId?: string
  ipAddress: string
  userAgent: string
  deviceType?: string
  createdAt: Date
  lastActivityAt: Date
  expiresAt: Date
  isActive: boolean
  location?: {
    country?: string
    city?: string
    region?: string
  }
}

export interface ActiveSession extends UserSession {
  // Additional runtime info
  jwt?: string
}

export interface SessionCreateOptions {
  userId: string
  organizationId?: string
  ipAddress: string
  userAgent: string
  deviceType?: string
  location?: UserSession['location']
  expiresIn?: number // seconds until expiration
}

export interface SessionQueryOptions {
  userId?: string
  organizationId?: string
  ipAddress?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export interface SessionStats {
  total: number
  active: number
  byDevice: Record<string, number>
  byLocation: Record<string, number>
}

export interface RevokeOptions {
  sessionId?: string
  allSessions?: boolean
  exceptCurrent?: boolean
  userId?: string
}

export interface SessionStore {
  create: (session: Omit<UserSession, 'id'>) => Promise<UserSession>
  findById: (id: string) => Promise<UserSession | null>
  findMany: (options: SessionQueryOptions) => Promise<UserSession[]>
  update: (id: string, data: Partial<UserSession>) => Promise<UserSession | null>
  delete: (id: string) => Promise<boolean>
  deleteMany: (userId: string, exceptId?: string) => Promise<number>
  count: (options: SessionQueryOptions) => Promise<number>
  getStats: (userId: string) => Promise<SessionStats>
}

export interface SessionServiceConfig {
  /** Session TTL in seconds (default: 24 hours) */
  sessionTTL: number
  /** Maximum sessions per user (default: 10) */
  maxSessionsPerUser: number
  /** Enable device fingerprinting */
  enableDeviceFingerprint: boolean
  /** Enable IP-based session validation */
  enableIPValidation: boolean
  /** Enable geo-location tracking */
  enableGeoLocation: boolean
}

export const DEFAULT_SESSION_CONFIG: SessionServiceConfig = {
  sessionTTL: 24 * 60 * 60, // 24 hours
  maxSessionsPerUser: 10,
  enableDeviceFingerprint: true,
  enableIPValidation: true,
  enableGeoLocation: false,
}

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: SessionErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'SessionError'
  }
}

export enum SessionErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  MAX_SESSIONS_REACHED = 'MAX_SESSIONS_REACHED',
  INVALID_SESSION = 'INVALID_SESSION',
  IP_MISMATCH = 'IP_MISMATCH',
  DEVICE_MISMATCH = 'DEVICE_MISMATCH',
  STORE_ERROR = 'STORE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

/**
 * Session token payload for JWT
 */
export interface SessionTokenPayload {
  sessionId: string
  userId: string
  organizationId?: string
  createdAt: number
  expiresAt: number
}

/**
 * Device information extracted from user agent
 */
export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  os: string | null
  browser: string | null
  model: string | null
}
