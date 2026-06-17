/**
 * Supabase Session Store
 * Stores session data in Supabase database
 */
import { createClient } from '@supabase/supabase-js'
import type { SessionStore, UserSession, SessionQueryOptions, SessionStats } from './types'
import { SessionError, SessionErrorCode } from './types'
import { generateSessionId, isSessionExpired } from './utils'

interface SessionRecord {
  id: string
  user_id: string
  organization_id: string | null
  ip_address: string
  user_agent: string
  device_type: string | null
  location: Record<string, string> | null
  created_at: string
  last_activity_at: string
  expires_at: string
  is_active: boolean
  fingerprint: string | null
}

interface SessionTable {
  id: string
  user_id: string
  organization_id: string | null
  ip_address: string
  user_agent: string
  device_type: string | null
  location: Record<string, string> | null
  created_at: string
  last_activity_at: string
  expires_at: string
  is_active: boolean
  fingerprint: string | null
}

/**
 * Supabase Session Store
 * Uses Supabase PostgreSQL database to store session data
 */
export class SupabaseSessionStore implements SessionStore {
  private supabase: ReturnType<typeof createClient>
  private tableName: string

  constructor(supabaseUrl?: string, supabaseKey?: string, tableName: string = 'sessions') {
    this.supabase = createClient(supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    this.tableName = tableName
  }

  /**
   * Convert database record to UserSession
   */
  private recordToSession(record: SessionRecord): UserSession {
    return {
      id: record.id,
      userId: record.user_id,
      organizationId: record.organization_id || undefined,
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      deviceType: record.device_type || undefined,
      createdAt: new Date(record.created_at),
      lastActivityAt: new Date(record.last_activity_at),
      expiresAt: new Date(record.expires_at),
      isActive: record.is_active,
      location: record.location ? {
        country: record.location.country,
        city: record.location.city,
        region: record.location.region,
      } : undefined,
    }
  }

  /**
   * Convert UserSession to database record
   */
  private sessionToRecord(session: Omit<UserSession, 'id'> & { id?: string }): Partial<SessionRecord> {
    const record: Partial<SessionRecord> = {
      user_id: session.userId,
      organization_id: session.organizationId || null,
      ip_address: session.ipAddress,
      user_agent: session.userAgent,
      device_type: session.deviceType || null,
      location: session.location
        ? {
            country: session.location.country || '',
            city: session.location.city || '',
            region: session.location.region || '',
          }
        : null,
      created_at: session.createdAt.toISOString(),
      last_activity_at: session.lastActivityAt.toISOString(),
      expires_at: session.expiresAt.toISOString(),
      is_active: session.isActive,
    }

    if (session.id) {
      record.id = session.id
    }

    return record
  }

  /**
   * Ensure the sessions table exists
   */
  async ensureTableExists(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', this.tableName)
        .single()

      if (error && !data) {
        // Table doesn't exist, create it
        await this.createSessionsTable()
      }
    } catch {
      await this.createSessionsTable()
    }
  }

  /**
   * Create the sessions table
   */
  private async createSessionsTable(): Promise<void> {
    await this.supabase.rpc('create_sessions_table', {
      table_name: this.tableName,
    })
  }

  async create(session: Omit<UserSession, 'id'>): Promise<UserSession> {
    try {
      const record = this.sessionToRecord({
        ...session,
        id: generateSessionId(),
      })

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(record as SessionRecord)
        .select()
        .single()

      if (error) {
        throw new SessionError(
          `Failed to create session: ${error.message}`,
          SessionErrorCode.STORE_ERROR,
          { error: error.message }
        )
      }

      if (!data) {
        throw new SessionError(
          'Session creation returned no data',
          SessionErrorCode.STORE_ERROR
        )
      }

      return this.recordToSession(data as SessionRecord)
    } catch (error) {
      if (error instanceof SessionError) {
        throw error
      }
      throw new SessionError(
        error instanceof Error ? error.message : 'Failed to create session',
        SessionErrorCode.STORE_ERROR
      )
    }
  }

  async findById(id: string): Promise<UserSession | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return null
      }

      const session = this.recordToSession(data as SessionRecord)

      // Check if session is expired
      if (isSessionExpired(session.expiresAt)) {
        // Mark as inactive
        await this.update(session.id, { isActive: false })
        return null
      }

      return session
    } catch {
      return null
    }
  }

  async findMany(options: SessionQueryOptions): Promise<UserSession[]> {
    try {
      let query = this.supabase.from(this.tableName).select('*')

      if (options.userId) {
        query = query.eq('user_id', options.userId)
      }

      if (options.organizationId) {
        query = query.eq('organization_id', options.organizationId)
      }

      if (options.ipAddress) {
        query = query.eq('ip_address', options.ipAddress)
      }

      if (options.isActive !== undefined) {
        query = query.eq('is_active', options.isActive)
      }

      if (options.limit) {
        query = query.limit(options.limit)
      }

      if (options.offset) {
        query = query.offset(options.offset)
      }

      // Order by last activity (most recent first)
      query = query.order('last_activity_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        return []
      }

      return (data as SessionRecord[]).map(this.recordToSession)
    } catch {
      return []
    }
  }

  async update(id: string, data: Partial<UserSession>): Promise<UserSession | null> {
    try {
      const record = this.sessionToRecord({
        ...(await this.findById(id))!,
        ...data,
        id,
      })

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(record)
        .eq('id', id)
        .select()
        .single()

      if (error || !result) {
        return null
      }

      return this.recordToSession(result as SessionRecord)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)

      return !error
    } catch {
      return false
    }
  }

  async deleteMany(userId: string, exceptId?: string): Promise<number> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', userId)

      if (exceptId) {
        query = query.neq('id', exceptId)
      }

      const { error } = await query

      if (error) {
        return 0
      }

      // Return the number of deleted sessions
      // Note: Supabase doesn't return count for delete, so we estimate
      return -1 // We don't have the exact count
    } catch {
      return 0
    }
  }

  async count(options: SessionQueryOptions): Promise<number> {
    try {
      let query = this.supabase.from(this.tableName).select('*', { count: 'exact', head: true })

      if (options.userId) {
        query = query.eq('user_id', options.userId)
      }

      if (options.organizationId) {
        query = query.eq('organization_id', options.organizationId)
      }

      if (options.ipAddress) {
        query = query.eq('ip_address', options.ipAddress)
      }

      if (options.isActive !== undefined) {
        query = query.eq('is_active', options.isActive)
      }

      const { count, error } = await query

      if (error) {
        return 0
      }

      return count || 0
    } catch {
      return 0
    }
  }

  async getStats(userId: string): Promise<SessionStats> {
    try {
      const sessions = await this.findMany({ userId, isActive: true })

      const byDevice: Record<string, number> = {}
      const byLocation: Record<string, number> = {}

      for (const session of sessions) {
        // Count by device type
        const device = session.deviceType || 'unknown'
        byDevice[device] = (byDevice[device] || 0) + 1

        // Count by location
        if (session.location?.country) {
          byLocation[session.location.country] = (byLocation[session.location.country] || 0) + 1
        }
      }

      return {
        total: await this.count({ userId }),
        active: sessions.length,
        byDevice,
        byLocation,
      }
    } catch {
      return {
        total: 0,
        active: 0,
        byDevice: {},
        byLocation: {},
      }
    }
  }
}

/**
 * Create a Supabase session store instance
 */
export function createSupabaseSessionStore(
  tableName?: string
): SupabaseSessionStore {
  return new SupabaseSessionStore(undefined, undefined, tableName)
}

/**
 * Singleton instance
 */
let sessionStore: SupabaseSessionStore | null = null

export function getSessionStore(): SupabaseSessionStore {
  if (!sessionStore) {
    sessionStore = createSupabaseSessionStore()
  }
  return sessionStore
}
