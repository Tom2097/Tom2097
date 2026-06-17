/**
 * IP Whitelisting Types
 */

export interface IPAddress {
  address: string
  type: 'ipv4' | 'ipv6'
}

export interface IPRange {
  start: string
  end: string
  type: 'ipv4' | 'ipv6'
}

export interface IPWhitelistEntry {
  id: string
  organizationId?: string
  userId?: string
  name: string
  description?: string
  ipAddresses: string[]
  ipRanges?: IPRange[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface IPWhitelistCheckResult {
  allowed: boolean
  matchedEntry?: IPWhitelistEntry
  reason?: IPWhitelistDenyReason
}

export interface IPWhitelistStats {
  totalEntries: number
  activeEntries: number
  byOrganization: Record<string, number>
  byUser: Record<string, number>
}

export interface CreateWhitelistEntryOptions {
  organizationId?: string
  userId?: string
  name: string
  description?: string
  ipAddresses: string[]
  ipRanges?: IPRange[]
  isActive?: boolean
  createdBy: string
}

export interface UpdateWhitelistEntryOptions extends Partial<CreateWhitelistEntryOptions> {
  id: string
}

export class IPWhitelistError extends Error {
  constructor(
    message: string,
    public readonly code: IPWhitelistErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'IPWhitelistError'
  }
}

export enum IPWhitelistErrorCode {
  ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND',
  INVALID_IP_ADDRESS = 'INVALID_IP_ADDRESS',
  INVALID_IP_RANGE = 'INVALID_IP_RANGE',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  UNAUTHORIZED = 'UNAUTHORIZED',
  STORE_ERROR = 'STORE_ERROR',
}

export enum IPWhitelistDenyReason {
  NOT_WHITELISTED = 'NOT_WHITELISTED',
  ENTRY_INACTIVE = 'ENTRY_INACTIVE',
  ORGANIZATION_NOT_ALLOWED = 'ORGANIZATION_NOT_ALLOWED',
  USER_NOT_ALLOWED = 'USER_NOT_ALLOWED',
  ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND',
}

/**
 * IP address validation patterns
 */
export const IPv4_PATTERN = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
export const IPv6_PATTERN = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|\[[0-9a-fA-F:]+\]|::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|\[::[0-9a-fA-F:]+\]$/
