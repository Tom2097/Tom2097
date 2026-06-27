/**
 * File Upload Validators
 */
import {
  FileTypeConfig,
  DEFAULT_FILE_TYPES,
  StorageError,
  StorageErrorCode,
} from './types'

/**
 * Validate file against type configuration
 */
export function validateFileType(
  file: {
    name: string
    size: number
    type: string
  },
  allowedTypes: FileTypeConfig = DEFAULT_FILE_TYPES.any
): { valid: boolean; error?: StorageError } {
  // Check file size
  if (file.size > allowedTypes.maxSize) {
    return {
      valid: false,
      error: new StorageError(
        `File size exceeds maximum of ${allowedTypes.maxSize / 1024 / 1024}MB`,
        StorageErrorCode.FILE_TOO_LARGE,
        { size: file.size, maxSize: allowedTypes.maxSize }
      ),
    }
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (
    allowedTypes.allowedExtensions[0] !== '*' &&
    extension &&
    !allowedTypes.allowedExtensions.includes(extension)
  ) {
    return {
      valid: false,
      error: new StorageError(
        `File extension '.${extension}' is not allowed`,
        StorageErrorCode.INVALID_FILE_TYPE,
        { extension, allowedExtensions: allowedTypes.allowedExtensions }
      ),
    }
  }

  // Check MIME type
  if (
    allowedTypes.allowedTypes[0] !== '*' &&
    file.type &&
    !allowedTypes.allowedTypes.includes(file.type)
  ) {
    return {
      valid: false,
      error: new StorageError(
        `File type '${file.type}' is not allowed`,
        StorageErrorCode.INVALID_FILE_TYPE,
        { type: file.type, allowedTypes: allowedTypes.allowedTypes }
      ),
    }
  }

  return { valid: true }
}

/**
 * Get file type from MIME type
 */
export function getFileCategory(mimeType: string): keyof typeof DEFAULT_FILE_TYPES {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (
    mimeType.startsWith('application/pdf') ||
    mimeType.startsWith('application/msword') ||
    mimeType.startsWith('application/vnd.') ||
    mimeType.startsWith('text/')
  ) {
    return 'document'
  }
  return 'any'
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path information
  const cleanFilename = filename.replace(/^.*[\\/]/, '')
  
  // Remove potentially dangerous characters
  const sanitized = cleanFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  
  // Prevent empty filenames
  if (!sanitized || sanitized === '.') {
    return `file_${Date.now()}`
  }
  
  return sanitized
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(
  originalName: string,
  prefix?: string
): string {
  const sanitized = sanitizeFilename(originalName)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  
  const extension = sanitized.split('.').pop()
  const baseName = sanitized.substring(0, sanitized.lastIndexOf('.'))
  
  if (prefix) {
    return `${prefix}/${timestamp}_${random}_${baseName}.${extension}`
  }
  
  return `${timestamp}_${random}_${sanitized}`
}

/**
 * Get file extension from filename or MIME type
 */
export function getFileExtension(
  filename: string,
  mimeType?: string
): string {
  const fromFilename = filename.split('.').pop()?.toLowerCase()
  
  if (fromFilename && fromFilename !== filename) {
    return fromFilename
  }
  
  // Try to get from MIME type
  if (mimeType) {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/json': 'json',
      'text/csv': 'csv',
      'text/plain': 'txt',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
    }
    return extensionMap[mimeType] || 'bin'
  }
  
  return 'bin'
}

/**
 * Convert various file inputs to Buffer
 */
export async function toBuffer(file: Buffer | Blob | ReadableStream): Promise<Buffer> {
  if (Buffer.isBuffer(file)) {
    return file
  }
  
  if (file instanceof Blob) {
    return Buffer.from(await file.arrayBuffer())
  }
  
  // Handle ReadableStream
  if ('getReader' in file) {
    const chunks: Uint8Array[] = []
    const reader = file.getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    
    return Buffer.concat(chunks)
  }
  
  throw new Error('Unsupported file type')
}

/**
 * Create file validator middleware for API routes
 */
export function createFileValidator(
  allowedTypes: FileTypeConfig = DEFAULT_FILE_TYPES.any
) {
  return (file: { name: string; size: number; type: string }) => {
    return validateFileType(file, allowedTypes)
  }
}
