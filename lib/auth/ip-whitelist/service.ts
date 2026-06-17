/**
 * IP Whitelisting Service
 * Manages IP address whitelists for organizations and users
 */
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
    // IPv6 range checking is more complex
    // For now, just check if IP starts with range start
    return ip.startsWith(range.start)
  }
  
  const ipNum = ipToNumber(ip)
  const startNum = ipToNumber(range.start)
  const endNum = ipToNumber(range.end)
  
  return ipNum >= startNum && ipNum <= endNum
}

/**
 * Simple in-memory IP whitelist store
 * In production, replace with database-backed store
 */
class MemoryIPWhitelistStore {
  private entries: Map<string, IPWhitelistEntry> = new Map()

  async create(options: CreateWhitelistEntryOptions): Promise<IPWhitelistEntry> {
    const entry: IPWhitelistEntry = {
      id: this.generateId(),
      organizationId: options.organizationId,
      userId: options.userId,
      name: options.name,
      description: options.description,
      ipAddresses: options.ipAddresses,
      ipRanges: options.ipRanges,
      isActive: options.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: options.createdBy,
    }

    // Validate entries
    this.validateEntry(entry)

    this.entries.set(entry.id, entry)
    return entry
  }

  async findById(id: string): Promise<IPWhitelistEntry | null> {
    return this.entries.get(id) || null
  }

  async findMany(options: {
    organizationId?: string
    userId?: string
    isActive?: boolean
  }): Promise<IPWhitelistEntry[]> {
    const results: IPWhitelistEntry[] = []
    
    for (const entry of this.entries.values()) {
      if (options.organizationId && entry.organizationId !== options.organizationId) {
        continue
      }
      if (options.userId && entry.userId !== options.userId) {
        continue
      }
      if (options.isActive !== undefined && entry.isActive !== options.isActive) {
        continue
      }
      results.push(entry)
    }
    
    return results
  }

  async update(options: UpdateWhitelistEntryOptions): Promise<IPWhitelistEntry | null> {
    const existing = await this.findById(options.id)
    if (!existing) {
      return null
    }

    const updated: IPWhitelistEntry = {
      ...existing,
      ...options,
      id: options.id,
      updatedAt: new Date(),
    }

    this.validateEntry(updated)
    this.entries.set(options.id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id)
  }

  async getStats(organizationId?: string): Promise<IPWhitelistStats> {
    const byOrganization: Record<string, number> = {}
    const byUser: Record<string, number> = {}
    let total = 0
    let active = 0

    for (const entry of this.entries.values()) {
      if (organizationId && entry.organizationId !== organizationId) {
        continue
      }

      total++
      if (entry.isActive) {
        active++
      }

      if (entry.organizationId) {
        byOrganization[entry.organizationId] = (byOrganization[entry.organizationId] || 0) + 1
      }
      if (entry.userId) {
        byUser[entry.userId] = (byUser[entry.userId] || 0) + 1
      }
    }

    return {
      totalEntries: total,
      activeEntries: active,
      byOrganization,
      byUser,
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  private validateEntry(entry: IPWhitelistEntry): void {
    // Validate IP addresses
    for (const ip of entry.ipAddresses) {
      if (!IPv4_PATTERN.test(ip) && !IPv6_PATTERN.test(ip)) {
        throw new IPWhitelistError(
          `Invalid IP address: ${ip}`,
          IPWhitelistErrorCode.INVALID_IP_ADDRESS
        )
      }
    }

    // Validate IP ranges
    if (entry.ipRanges) {
      for (const range of entry.ipRanges) {
        if (!IPv4_PATTERN.test(range.start) || !IPv4_PATTERN.test(range.end)) {
          throw new IPWhitelistError(
            `Invalid IP range: ${range.start} to ${range.end}`,
            IPWhitelistErrorCode.INVALID_IP_RANGE
          )
        }

        const startNum = ipToNumber(range.start)
        const endNum = ipToNumber(range.end)

        if (startNum > endNum) {
          throw new IPWhitelistError(
            `Invalid IP range: start > end`,
            IPWhitelistErrorCode.INVALID_IP_RANGE
          )
        }
      }
    }
  }
}

/**
 * IP Whitelisting Service
 */
export class IPWhitelistService {
  private store: MemoryIPWhitelistStore

  constructor(store?: MemoryIPWhitelistStore) {
    this.store = store || new MemoryIPWhitelistStore()
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

    return request.ip || '0.0.0.0'
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
