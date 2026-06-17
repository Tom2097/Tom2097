/**
 * Local File System Storage Provider
 * For development and testing only
 */
import fs from 'fs/promises'
import path from 'path'
import {
  UploadOptions,
  UploadResult,
  FileInfo,
  DeleteOptions,
  StorageProvider,
  StorageError,
  StorageErrorCode,
} from './types'
import {
  sanitizeFilename,
  generateUniqueFilename,
  toBuffer,
} from './validators'

interface LocalStorageConfig {
  /** Base directory for file storage */
  basePath: string
  /** Public URL base path */
  publicUrl: string
  /** Enable/disable local storage */
  enabled: boolean
}

const DEFAULT_CONFIG: LocalStorageConfig = {
  basePath: path.join(process.cwd(), 'storage'),
  publicUrl: '/storage',
  enabled: process.env.NODE_ENV !== 'production',
}

/**
 * Local filesystem storage provider
 * NOTE: Only suitable for development. Not for production use.
 */
export class LocalStorageProvider implements StorageProvider {
  private config: LocalStorageConfig

  constructor(config: Partial<LocalStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ensureBaseDirectory()
  }

  /**
   * Ensure the base storage directory exists
   */
  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.access(this.config.basePath)
    } catch {
      await fs.mkdir(this.config.basePath, { recursive: true })
    }
  }

  /**
   * Get the full path for a file key
   */
  private getFilePath(key: string): string {
    // Prevent path traversal
    const sanitizedKey = key.replace(/\.\./g, '').replace(/\./g, '')
    return path.join(this.config.basePath, sanitizedKey)
  }

  /**
   * Get the public URL for a file key
   */
  private getPublicUrl(key: string): string {
    const sanitizedKey = key.replace(/\.\./g, '').replace(/\./g, '')
    return `${this.config.publicUrl}/${sanitizedKey}`
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        key: '',
        error: 'Local storage is disabled in production',
        size: 0,
        contentType: options.contentType || '',
      }
    }

    try {
      const fileBuffer = await toBuffer(options.file)
      const filename = sanitizeFilename(options.filename)
      const folder = options.folder || ''
      const uniqueFilename = generateUniqueFilename(filename, folder)
      const key = folder ? `${folder}/${uniqueFilename}` : uniqueFilename
      const filePath = this.getFilePath(key)

      // Create folder if it doesn't exist
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(filePath, fileBuffer, {
        mode: options.access === 'public' ? 0o644 : 0o600,
      })

      return {
        success: true,
        key,
        url: this.getPublicUrl(key),
        size: fileBuffer.length,
        contentType: options.contentType || 'application/octet-stream',
      }
    } catch (error) {
      console.error('[LocalStorage] Upload error:', error)
      return {
        success: false,
        key: '',
        error: error instanceof Error ? error.message : 'Upload failed',
        size: 0,
        contentType: '',
      }
    }
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      const filePath = this.getFilePath(key)
      const fileBuffer = await fs.readFile(filePath)
      return fileBuffer
    } catch {
      return null
    }
  }

  async getFileInfo(key: string): Promise<FileInfo | null> {
    try {
      const filePath = this.getFilePath(key)
      const stats = await fs.stat(filePath)

      return {
        key,
        filename: path.basename(key),
        size: stats.size,
        contentType: 'application/octet-stream', // Would need extension mapping
        url: this.getPublicUrl(key),
        lastModified: stats.mtime,
      }
    } catch {
      return null
    }
  }

  async delete(options: DeleteOptions): Promise<boolean> {
    try {
      const filePath = this.getFilePath(options.key)
      await fs.unlink(filePath)
      return true
    } catch (error) {
      if (options.quiet) {
        return false
      }
      throw new StorageError(
        `Failed to delete file: ${options.key}`,
        StorageErrorCode.PROVIDER_ERROR,
        { error: error instanceof Error ? error.message : undefined }
      )
    }
  }

  async list(options: { prefix?: string; limit?: number }): Promise<FileInfo[]> {
    try {
      const basePath = options.prefix
        ? this.getFilePath(options.prefix)
        : this.config.basePath

      const files = await fs.readdir(basePath, { recursive: true })
      const limit = options.limit || 100

      return files
        .slice(0, limit)
        .filter((file) => {
          const filePath = path.join(basePath, file)
          return fs
            .stat(filePath)
            .then((stats) => stats.isFile())
            .catch(() => false)
        })
        .map((file) => ({
          key: options.prefix ? `${options.prefix}/${file}` : file,
          filename: path.basename(file),
          size: 0, // Would need stat call
          contentType: 'application/octet-stream',
          url: this.getPublicUrl(options.prefix ? `${options.prefix}/${file}` : file),
          lastModified: new Date(),
        }))
    } catch {
      return []
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, signed URLs are just public URLs
    // In production, this should be overridden
    return this.getPublicUrl(key)
  }
}

/**
 * Create a local storage provider instance
 */
export function createLocalStorageProvider(
  config?: Partial<LocalStorageConfig>
): LocalStorageProvider {
  return new LocalStorageProvider(config)
}

/**
 * Singleton instance for easy import
 */
export const localStorage = new LocalStorageProvider()
