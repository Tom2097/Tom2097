/**
 * File Storage Service
 * Unified interface for file uploads, downloads, and management
 */

export * from './types'
export * from './validators'
export * from './local-provider'
export * from './r2-provider'

// Re-export providers
import { LocalStorageProvider, localStorage as localStorageProvider } from './local-provider'
import { R2StorageProvider, createR2StorageProvider, getR2StorageProvider } from './r2-provider'

export { LocalStorageProvider, localStorageProvider, R2StorageProvider, createR2StorageProvider, getR2StorageProvider }

// Storage provider types
import type { StorageProvider } from './types'
export type { StorageProvider }

/**
 * Main storage service that automatically selects the appropriate provider
 * Falls back to local storage if cloud storage is not configured
 */
class StorageService {
  private provider: StorageProvider

  constructor() {
    // Try to use R2 first, then fall back to local
    const r2Provider = getR2StorageProvider()
    this.provider = r2Provider || localStorageProvider
  }

  getProvider(): StorageProvider {
    return this.provider
  }

  async upload(options: {
    file: Buffer | Blob | ReadableStream
    filename: string
    contentType?: string
    folder?: string
    metadata?: Record<string, string>
    access?: 'public' | 'private'
  }) {
    return this.provider.upload(options)
  }

  async download(key: string) {
    return this.provider.download(key)
  }

  async getFileInfo(key: string) {
    return this.provider.getFileInfo(key)
  }

  async delete(key: string, quiet?: boolean) {
    return this.provider.delete({ key, quiet })
  }

  async list(options: { prefix?: string; limit?: number }) {
    return this.provider.list(options)
  }

  async getSignedUrl(key: string, expiresIn?: number) {
    return this.provider.getSignedUrl(key, expiresIn)
  }
}

/**
 * Singleton storage service instance
 */
export const storage = new StorageService()

/**
 * Get the current storage provider
 */
export function getStorageProvider(): StorageProvider {
  return storage.getProvider()
}

export default storage
