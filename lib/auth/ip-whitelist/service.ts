/**
 * IP Whitelisting Service
 * Manages IP address whitelists for organizations and users
 */
import { createServiceClient } from "@/lib/supabase/service"
import type { NextRequest } from 'next/server'
import type {
  IPAddress,
  IPRange,
  IPWhitelistEntry,
  IPWhitelistCheckResult,
  IPWhitelistStats,
  CreateWhitelistEntryOptions,
  UpdateWhitelistEntryOptions,
} from './types'
import { IPWhitelistError, IPWhitelistErrorCode, IPWhitelistDenyReason, IPv4_PATTERN, IPv6_PATTERN } from './types'

const TABLE = "ip_whitelist_entries"

/**
 * IP to number for range comparisons (IPv4 only for now)
 */
function ipToNumber(ip: string): number {
  if (!IPv4_PATTERN.test(ip)) {
    throw new IPWhitelistError(`Invalid IPv4 address: ${ip}`, IPWhitelistErrorCode.INVALID_IP_ADDRESS)
  }
  
  const parts = ip.split('.').map(Number)
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
}

/**
 * Check if an IP address is in a range
 */
function isInRange(ip: string, range: IPRange): boolean {
  if (range.type === 'ipv6') {
    return ip.startsWith(range.start)
  }
  
  const ipNum = ipToNumber(ip)
  const startNum = ipToNumber(range.start)
  const endNum = ipToNumber(range.end)
  
  return ipNum >= startNum && ipNum <= endNum
}

function rowToEntry(row: Record<string, unknown>): IPWhitelistEntry {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string | undefined,
    userId: row.user_id as string | undefined,
    name: row.name as string,
    description: row.description as string | undefined,
    ipAddresses: (row.ip_addresses as string[]) ?? [],
    ipRanges: (row.ip_ranges as IPRange[]) ?? [],
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    createdBy: (row.created_by as string) ?? "",
  }
}

/**
 * Database-backed IP whitelist store using Supabase.
 */
class DbIPWhitelistStore {
  private db() { return createServiceClient() }

  async create(options: CreateWhitelistEntryOptions): Promise<IPWhitelistEntry> {
    const { data, error } = await this.db()
      .from(TABLE)
      .insert({
        organization_id: options.organizationId,
        user_id: options.userId ?? null,
        name: options.name,
        description: options.description ?? null,
        ip_addresses: options.ipAddresses,
        ip_ranges: options.ipRanges ?? [],
        is_active: options.isActive !== false,
        created_by: options.createdBy ?? null,
      })
      .select()
      .single()
    if (error) throw new IPWhitelistError(error.message, IPWhitelistErrorCode.INVALID_IP_ADDRESS)
    return rowToEntry(data)
  }

  async findById(id: string): Promise<IPWhitelistEntry | null> {
    const { data } = await this.db().from(TABLE).select("*").eq("id", id).maybeSingle()
    return data ? rowToEntry(data) : null
  }

  async findMany(options: {
    organizationId?: string
    userId?: string
    isActive?: boolean
  }): Promise<IPWhitelistEntry[]> {
    let query = this.db().from(TABLE).select("*")
    if (options.organizationId) query = query.eq("organization_id", options.organizationId)
    if (options.userId) query = query.eq("user_id", options.userId)
    if (options.isActive !== undefined) query = query.eq("is_active", options.isActive)
    const { data } = await query
    return (data ?? []).map(rowToEntry)
  }

  async update(options: UpdateWhitelistEntryOptions): Promise<IPWhitelistEntry | null> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (options.name !== undefined) patch.name = options.name
    if (options.description !== undefined) patch.description = options.description
    if (options.ipAddresses !== undefined) patch.ip_addresses = options.ipAddresses
    if (options.ipRanges !== undefined) patch.ip_ranges = options.ipRanges
    if (options.isActive !== undefined) patch.is_active = options.isActive

    const { data, error } = await this.db()
      .from(TABLE)
      .update(patch)
      .eq("id", options.id)
      .select()
      .maybeSingle()
    if (error) throw new IPWhitelistError(error.message, IPWhitelistErrorCode.INVALID_IP_ADDRESS)
    return data ? rowToEntry(data) : null
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.db().from(TABLE).delete().eq("id", id)
    return !error
  }

  async getStats(organizationId?: string): Promise<IPWhitelistStats> {
    let query = this.db().from(TABLE).select("organization_id, is_active", { count: "exact" })
    if (organizationId) query = query.eq("organization_id", organizationId)
    const { data, count } = await query
    const rows = (data ?? []) as Array<{ organization_id: string; is_active: boolean }>
    const byOrganization: Record<string, number> = {}
    let active = 0
    for (const r of rows) {
      byOrganization[r.organization_id] = (byOrganization[r.organization_id] || 0) + 1
      if (r.is_active) active++
    }
    return {
      totalEntries: count ?? rows.length,
      activeEntries: active,
      byOrganization,
      byUser: {},
    }
  }
}

/**
 * IP Whitelisting Service
 */
export class IPWhitelistService {
  private store: DbIPWhitelistStore

  constructor(store?: DbIPWhitelistStore) {
    this.store = store || new DbIPWhitelistStore()
  }

  /**
   * Extract IP address from request
   */
  extractIP(request: NextRequest): string {
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

    return '0.0.0.0'
  }

  /**
   * Check if an IP address is whitelisted
   */
  async checkIP(ip: string, options?: {
    organizationId?: string
    userId?: string
  }): Promise<IPWhitelistCheckResult> {
    // Skip localhost
    if (['127.0.0.1', '::1', 'localhost'].includes(ip)) {
      return { allowed: true }
    }

    // Get all relevant entries
    const entries = await this.store.findMany({
      organizationId: options?.organizationId,
      userId: options?.userId,
      isActive: true,
    })

    // Check against all entries
    for (const entry of entries) {
      // Check individual IP addresses
      if (entry.ipAddresses.includes(ip)) {
        return { allowed: true, matchedEntry: entry }
      }

      // Check IP ranges
      if (entry.ipRanges) {
        for (const range of entry.ipRanges) {
          if (isInRange(ip, range)) {
            return { allowed: true, matchedEntry: entry }
          }
        }
      }
    }

    return {
      allowed: false,
      reason: options?.organizationId
        ? IPWhitelistDenyReason.ORGANIZATION_NOT_ALLOWED
        : IPWhitelistDenyReason.NOT_WHITELISTED,
    }
  }

  /**
   * Check if the current request's IP is whitelisted
   */
  async checkRequest(request: NextRequest, options?: {
    organizationId?: string
    userId?: string
  }): Promise<IPWhitelistCheckResult> {
    const ip = this.extractIP(request)
    return this.checkIP(ip, options)
  }

  /**
   * Create a new whitelist entry
   */
  async createEntry(options: CreateWhitelistEntryOptions): Promise<IPWhitelistEntry> {
    return this.store.create(options)
  }

  /**
   * Get a whitelist entry by ID
   */
  async getEntry(id: string): Promise<IPWhitelistEntry | null> {
    return this.store.findById(id)
  }

  /**
   * List whitelist entries
   */
  async listEntries(options: {
    organizationId?: string
    userId?: string
    isActive?: boolean
  }): Promise<IPWhitelistEntry[]> {
    return this.store.findMany(options)
  }

  /**
   * Update a whitelist entry
   */
  async updateEntry(options: UpdateWhitelistEntryOptions): Promise<IPWhitelistEntry | null> {
    return this.store.update(options)
  }

  /**
   * Delete a whitelist entry
   */
  async deleteEntry(id: string): Promise<boolean> {
    return this.store.delete(id)
  }

  /**
   * Get whitelist statistics
   */
  async getStats(organizationId?: string): Promise<IPWhitelistStats> {
    return this.store.getStats(organizationId)
  }

  /**
   * Add IP addresses to an existing entry
   */
  async addIPAddresses(
    id: string,
    ipAddresses: string[]
  ): Promise<IPWhitelistEntry | null> {
    const entry = await this.store.findById(id)
    if (!entry) {
      return null
    }

    return this.store.update({
      id,
      ipAddresses: [...entry.ipAddresses, ...ipAddresses],
    })
  }

  /**
   * Remove IP addresses from an existing entry
   */
  async removeIPAddresses(
    id: string,
    ipAddresses: string[]
  ): Promise<IPWhitelistEntry | null> {
    const entry = await this.store.findById(id)
    if (!entry) {
      return null
    }

    return this.store.update({
      id,
      ipAddresses: entry.ipAddresses.filter((ip) => !ipAddresses.includes(ip)),
    })
  }

  /**
   * Check if an IP is in any CIDR range
   * Note: This is a simplified implementation
   */
  isIPInCIDR(ip: string, cidr: string): boolean {
    // Parse CIDR (e.g., 192.168.1.0/24)
    const [range, prefixLengthStr] = cidr.split('/')
    const prefixLength = parseInt(prefixLengthStr, 10)

    if (isNaN(prefixLength)) {
      return false
    }

    try {
      const ipNum = ipToNumber(ip)
      const rangeNum = ipToNumber(range)

      // Calculate network mask
      const mask = prefixLength === 0 ? 0 : ~((1 << (32 - prefixLength)) - 1)
      
      // Check if IP is in range
      return (ipNum & mask) === (rangeNum & mask)
    } catch {
      return false
    }
  }
}

/**
 * Singleton IP whitelist service instance
 */
let ipWhitelistService: IPWhitelistService | null = null

export function getIPWhitelistService(): IPWhitelistService {
  if (!ipWhitelistService) {
    ipWhitelistService = new IPWhitelistService()
  }
  return ipWhitelistService
}

export function createIPWhitelistService(): IPWhitelistService {
  return new IPWhitelistService()
}
