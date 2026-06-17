/**
 * Cloudflare R2 Storage Provider
 * Production-ready S3-compatible storage
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner'
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

interface R2StorageConfig {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicDomain?: string
}

/**
 * Cloudflare R2 Storage Provider
 * S3-compatible API with Cloudflare's R2
 */
export class R2StorageProvider implements StorageProvider {
  private client: S3Client
  private config: R2StorageConfig

  constructor(config: R2StorageConfig) {
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      throw new StorageError(
        'R2 storage requires accountId, accessKeyId, secretAccessKey, and bucketName',
        StorageErrorCode.INVALID_CONFIGURATION
      )
    }

    this.config = config

    const s3Config: S3ClientConfig = {
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }

    this.client = new S3Client(s3Config)
  }

  /**
   * Get the S3 key for a file
   */
  private getS3Key(folder: string | undefined, filename: string): string {
    const sanitizedFilename = sanitizeFilename(filename)
    const uniqueFilename = generateUniqueFilename(sanitizedFilename)
    return folder ? `${folder}/${uniqueFilename}` : uniqueFilename
  }

  /**
   * Get the public URL for a file
   */
  private getPublicUrl(key: string): string {
    if (this.config.publicDomain) {
      return `https://${this.config.publicDomain}/${key}`
    }
    return `https://${this.config.accountId}.r2.cloudflarestorage.com/${this.config.bucketName}/${key}`
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      const fileBuffer = await toBuffer(options.file)
      const key = this.getS3Key(options.folder, options.filename)

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: options.contentType || 'application/octet-stream',
        ...(options.metadata && { Metadata: options.metadata }),
        ...(options.access === 'public' && { ACL: 'public-read' }),
      })

      await this.client.send(command)

      return {
        success: true,
        key,
        url: this.getPublicUrl(key),
        size: fileBuffer.length,
        contentType: options.contentType || 'application/octet-stream',
      }
    } catch (error) {
      console.error('[R2Storage] Upload error:', error)
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
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      })

      const response = await this.client.send(command)
      const chunks: Uint8Array[] = []

      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk)
      }

      return Buffer.concat(chunks)
    } catch {
      return null
    }
  }

  async getFileInfo(key: string): Promise<FileInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      })

      const response = await this.client.send(command)

      return {
        key,
        filename: key.split('/').pop() || key,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        url: this.getPublicUrl(key),
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata,
      }
    } catch {
      return null
    }
  }

  async delete(options: DeleteOptions): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: options.key,
      })

      await this.client.send(command)
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
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: options.prefix,
        MaxKeys: options.limit,
      })

      const response = await this.client.send(command)
      const files: FileInfo[] = []

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            files.push({
              key: object.Key,
              filename: object.Key.split('/').pop() || object.Key,
              size: object.Size || 0,
              contentType: 'application/octet-stream',
              url: this.getPublicUrl(object.Key),
              lastModified: object.LastModified || new Date(),
            })
          }
        }
      }

      return files
    } catch {
      return []
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      })

      const signedUrl = await getS3SignedUrl(this.client, command, {
        expiresIn,
      })

      return signedUrl
    } catch {
      // Fallback to public URL
      return this.getPublicUrl(key)
    }
  }
}

/**
 * Create an R2 storage provider from environment variables
 */
export function createR2StorageProvider(): R2StorageProvider | null {
  const config: R2StorageConfig = {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
    publicDomain: process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN,
  }

  // Validate required fields
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    console.warn('[R2Storage] Missing configuration, falling back to local storage')
    return null
  }

  return new R2StorageProvider(config)
}

/**
 * Singleton instance (created on first use)
 */
let r2Instance: R2StorageProvider | null = null

export function getR2StorageProvider(): R2StorageProvider | null {
  if (!r2Instance) {
    r2Instance = createR2StorageProvider()
  }
  return r2Instance
}
