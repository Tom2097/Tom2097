/**
 * Session Management Service
 * Manages user sessions with advanced security features
 */
import type { NextRequest } from 'next/server'
import type {
  UserSession,
  ActiveSession,
  SessionCreateOptions,
  SessionQueryOptions,
  SessionStats,
  RevokeOptions,
  SessionServiceConfig,
} from './types'
import { SessionError, SessionErrorCode, DEFAULT_SESSION_CONFIG } from './types'
import {
  extractIP,
  extractUserAgent,
  parseDeviceInfo,
  generateSessionId,
  generateDeviceFingerprint,
  isSessionExpired,
  shouldRefreshSession,
  getLocationFromIP,
  createSessionToken,
  decodeSessionToken,
} from './utils'
import { getSessionStore } from './supabase-store'

/**
 * Session Service
 * Main service for managing user sessions
 */
export class SessionService {
  private store = getSessionStore()
  private config: SessionServiceConfig

  constructor(config: Partial<SessionServiceConfig> = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config }
  }

  /**
   * Create a new session for a user
   */
  async createSession(
    request: NextRequest,
    userId: string,
    organizationId?: string
  ): Promise<ActiveSession> {
    const ipAddress = extractIP(request)
    const userAgent = extractUserAgent(request)
    const deviceInfo = parseDeviceInfo(userAgent)
    const fingerprint = this.config.enableDeviceFingerprint
      ? generateDeviceFingerprint(userAgent, ipAddress)
      : undefined

    // Get location if enabled
    let location = undefined
    if (this.config.enableGeoLocation) {
      location = await getLocationFromIP(ipAddress)
    }

    // Check if user has too many active sessions
    const activeSessions = await this.store.count({
      userId,
      isActive: true,
    })

    if (activeSessions >= this.config.maxSessionsPerUser) {
      throw new SessionError(
        `Maximum sessions (${this.config.maxSessionsPerUser}) reached for this user`,
        SessionErrorCode.MAX_SESSIONS_REACHED,
        { maxSessions: this.config.maxSessionsPerUser, current: activeSessions }
      )
    }

    // Calculate expiration
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.config.sessionTTL * 1000)

    // Create session record
    const session: Omit<UserSession, 'id'> = {
      userId,
      organizationId,
      ipAddress,
      userAgent,
      deviceType: deviceInfo.type,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
      isActive: true,
      location,
    }

    // Store session
    const createdSession = await this.store.create(session)

    // Generate token
    const token = createSessionToken({
      sessionId: createdSession.id,
      userId,
      organizationId,
      expiresIn: this.config.sessionTTL,
    })

    return {
      ...createdSession,
      jwt: token,
    }
  }

  /**
   * Validate a session and return it
   */
  async validateSession(
    request: NextRequest,
    sessionId?: string,
    token?: string
  ): Promise<ActiveSession | null> {
    // Try to get session ID from token or header
    let currentSessionId = sessionId
    if (!currentSessionId && token) {
      const decoded = decodeSessionToken(token)
      if (decoded) {
        currentSessionId = decoded.sessionId
      }
    }

    if (!currentSessionId) {
      // Try to get from Authorization header
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const tokenFromHeader = authHeader.substring(7)
        const decoded = decodeSessionToken(tokenFromHeader)
        if (decoded) {
          currentSessionId = decoded.sessionId
        }
      }
    }

    if (!currentSessionId) {
      return null
    }

    // Get session from store
    const session = await this.store.findById(currentSessionId)
    if (!session) {
      return null
    }

    // Validate session
    const validation = await this.validateSessionIntegrity(request, session)
    if (!validation.valid) {
      // Optionally revoke the session if validation fails
      await this.revokeSession(currentSessionId)
      return null
    }

    // Update last activity
    await this.store.update(currentSessionId, {
      lastActivityAt: new Date(),
    })

    // Check if session needs refresh
    if (shouldRefreshSession(session.expiresAt)) {
      // Extend session
      const newExpiresAt = new Date(
        Date.now() + this.config.sessionTTL * 1000
      )
      await this.store.update(currentSessionId, {
        expiresAt: newExpiresAt,
      })
    }

    return {
      ...session,
      jwt: token || '',
    }
  }

  /**
   * Validate session integrity (IP, device fingerprint, etc.)
   */
  private async validateSessionIntegrity(
    request: NextRequest,
    session: UserSession
  ): Promise<{ valid: boolean; reason?: SessionErrorCode }> {
    // Check if session is expired
    if (isSessionExpired(session.expiresAt)) {
      return { valid: false, reason: SessionErrorCode.SESSION_EXPIRED }
    }

    // Check if session is marked as inactive
    if (!session.isActive) {
      return { valid: false, reason: SessionErrorCode.SESSION_REVOKED }
    }

    // Check IP address if enabled
    if (this.config.enableIPValidation) {
      const currentIP = extractIP(request)
      if (session.ipAddress !== currentIP) {
        return { valid: false, reason: SessionErrorCode.IP_MISMATCH }
      }
    }

    // All checks passed
    return { valid: true }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<ActiveSession[]> {
    const sessions = await this.store.findMany({
      userId,
      isActive: true,
      limit: 50,
    })

    return sessions.map((s) => ({ ...s, jwt: '' }))
  }

  /**
   * Get session statistics for a user
   */
  async getUserSessionStats(userId: string): Promise<SessionStats> {
    return this.store.getStats(userId)
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    const session = await this.store.findById(sessionId)
    if (!session) {
      return false
    }

    return this.store.update(sessionId, {
      isActive: false,
      lastActivityAt: new Date(),
    })
      .then(() => true)
      .catch(() => false)
  }

  /**
   * Revoke multiple sessions
   */
  async revokeSessions(options: RevokeOptions): Promise<number> {
    if (options.allSessions && options.userId) {
      // Revoke all sessions except optionally the current one
      const countBefore = await this.store.count({ userId: options.userId })
      
      await this.store.deleteMany(
        options.userId,
        options.exceptCurrent ? options.sessionId : undefined
      )
      
      const countAfter = await this.store.count({ userId: options.userId })
      return countBefore - countAfter
    }

    if (options.sessionId) {
      return (await this.revokeSession(options.sessionId)) ? 1 : 0
    }

    return 0
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    return this.revokeSessions({ allSessions: true, userId })
  }

  /**
   * Revoke all sessions except the current one
   */
  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    return this.revokeSessions({
      allSessions: true,
      userId,
      exceptCurrent: true,
      sessionId: currentSessionId,
    })
  }

  /**
   * Refresh a session (extend expiration)
   */
  async refreshSession(sessionId: string): Promise<ActiveSession | null> {
    const session = await this.store.findById(sessionId)
    if (!session) {
      return null
    }

    const newExpiresAt = new Date(Date.now() + this.config.sessionTTL * 1000)
    const updated = await this.store.update(sessionId, {
      expiresAt: newExpiresAt,
      lastActivityAt: new Date(),
    })

    if (!updated) {
      return null
    }

    // Generate new token
    const token = createSessionToken({
      sessionId,
      userId: session.userId,
      organizationId: session.organizationId,
      expiresIn: this.config.sessionTTL,
    })

    return {
      ...updated,
      jwt: token,
    }
  }

  /**
   * Get session count for a user
   */
  async getSessionCount(userId: string, activeOnly: boolean = true): Promise<number> {
    return this.store.count({ userId, isActive: activeOnly })
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    // Find all active sessions that are expired
    const now = new Date()
    
    // This is a simplified cleanup
    // In production, you might want to run this as a scheduled job
    // and optimize the query to only find expired sessions
    const allActive = await this.store.findMany({ isActive: true, limit: 1000 })
    
    let count = 0
    for (const session of allActive) {
      if (isSessionExpired(session.expiresAt)) {
        await this.store.update(session.id, { isActive: false })
        count++
      }
    }
    
    return count
  }
}

/**
 * Singleton session service instance
 */
let sessionService: SessionService | null = null

/**
 * Get the session service instance
 */
export function getSessionService(config?: Partial<SessionServiceConfig>): SessionService {
  if (!sessionService) {
    sessionService = new SessionService(config)
  }
  return sessionService
}

/**
 * Create a new session service instance
 */
export function createSessionService(config?: Partial<SessionServiceConfig>): SessionService {
  return new SessionService(config)
}

// Export types
export type {
  UserSession,
  ActiveSession,
  SessionCreateOptions,
  SessionQueryOptions,
  SessionStats,
  RevokeOptions,
  SessionServiceConfig,
}
