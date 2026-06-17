/**
 * Session Management Module
 * Exports all session-related functionality
 */

export * from './types'
export * from './utils'
export * from './supabase-store'
export * from './service'

// Re-export main classes and functions
import { SessionService, getSessionService, createSessionService } from './service'
import { SessionError, SessionErrorCode } from './types'
import type { UserSession, ActiveSession, SessionStats } from './types'

export { SessionService, getSessionService, createSessionService, SessionError, SessionErrorCode }
export type { UserSession, ActiveSession, SessionStats }
