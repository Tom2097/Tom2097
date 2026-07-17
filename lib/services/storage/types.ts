/**
 * File Storage Service Types
 */

export interface UploadOptions {
  /** File data (Buffer, Blob, or stream) */
  file: Buffer | Blob | ReadableStream
  /** File name */
  filename: string
  /** MIME type */
  contentType?: string
  /** Custom metadata */
  metadata?: Record<string, string>
  /** Access control (public or private) */
  access?: 'public' | 'private'
  /** Folder path within bucket */
  folder?: string
  /** Overwrite existing file? */
  overwrite?: boolean
}

export interface UploadResult {
  success: boolean
  key: string
  url?: string
  size: number
  contentType: string
  etag?: string
  error?: string
}

export interface FileInfo {
  key: string
  filename: string
  size: number
  contentType: string
  url: string
  lastModified: Date
  metadata?: Record<string, string>
}

export interface DeleteOptions {
  /** File key (path in bucket) */
  key: string
  /** Quiet mode (no error if file doesn't exist) */
  quiet?: boolean
}

export interface StorageProvider {
  upload: (options: UploadOptions) => Promise<UploadResult>
  download: (key: string) => Promise<Buffer | null>
  getFileInfo: (key: string) => Promise<FileInfo | null>
  delete: (options: DeleteOptions) => Promise<boolean>
  list: (options: { prefix?: string; limit?: number }) => Promise<FileInfo[]>
  getSignedUrl: (key: string, expiresIn?: number) => Promise<string>
}

export interface StorageConfig {
  provider: 'local' | 's3' | 'r2'
  options: Record<string, string>
}

/**
 * File type validation
 */
export interface FileTypeConfig {
  allowedTypes: string[]
  maxSize: number
  allowedExtensions: string[]
}

export const DEFAULT_FILE_TYPES: Record<string, FileTypeConfig> = {
  image: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  },
  document: {
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
  },
  video: {
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: ['mp4', 'webm', 'mov'],
  },
  audio: {
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['mp3', 'wav', 'ogg'],
  },
  any: {
    allowedTypes: ['*'],
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: ['*'],
  },
}

/**
 * Error types for file storage
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

export enum StorageErrorCode {
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
}
