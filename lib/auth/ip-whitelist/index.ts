/**
 * IP Whitelisting Module
 * Exports all IP whitelisting functionality
 */

export * from './types'
export * from './service'

// Re-export main classes and functions
import { IPWhitelistService, getIPWhitelistService, createIPWhitelistService } from './service'
import { IPWhitelistError, IPWhitelistErrorCode, IPWhitelistDenyReason } from './types'
import type { IPWhitelistEntry, IPWhitelistCheckResult, IPWhitelistStats } from './types'

export { IPWhitelistService, getIPWhitelistService, createIPWhitelistService, IPWhitelistError, IPWhitelistErrorCode, IPWhitelistDenyReason }
export type { IPWhitelistEntry, IPWhitelistCheckResult, IPWhitelistStats }
