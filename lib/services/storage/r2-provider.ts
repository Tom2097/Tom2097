/**
 * Cloudflare R2 Storage Provider
 * Production-ready S3-compatible storage
 * Uses dynamic imports to avoid AWS SDK initialization at module level
 */
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

// Lazy load AWS SDK modules to avoid initialization errors
let s3ClientModule: typeof import('@aws-sdk/client-s3') | null = null
let presignerModule: typeof import('@aws-sdk/s3-request-presigner') | null = null

async function loadS3Modules() {
   if (!s3ClientModule) {
    s3ClientModule = await import('@aws-sdk/client-s3')
  }
  if (!presignerModule) {
    presignerModule = await import('@aws-sdk/s3-request-presigner')
  }
  return { s3ClientModule, presignerModule }
}

/**
 * Cloudflare R2 Storage Provider
 * S3-compatible API with Cloudflare's R2
 */
export class R2StorageProvider implements StorageProvider {
  private config: R2StorageConfig
  private clientPromise: Promise<S3Client> | null = null

  constructor(config: R2StorageConfig) {
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      throw new StorageError(
        'R2 storage requires accountId, accessKeyId, secretAccessKey, and bucketName',
        StorageErrorCode.INVALID_CONFIGURATION
      )
    }

    this.config = config
  }

  private async getClient() {
    if (!this.clientPromise) {
      const { s3ClientModule } = await loadS3Modules()
      
      const s3Config = {
        region: 'auto',
        endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      }

      this.clientPromise = Promise.resolve(new s3ClientModule.S3Client(s3Config))
    }
    return this.clientPromise
  }

  private getS3Key(folder: string | undefined, filename: string): string {
    const sanitizedFilename = sanitizeFilename(filename)
    const uniqueFilename = generateUniqueFilename(sanitizedFilename)
    return folder ? `${folder}/${uniqueFilename}` : uniqueFilename
  }

  private getPublicUrl(key: string): string {
    if (this.config.publicDomain) {
      return `https://${this.config.publicDomain}/${key}`
    }
    return `https://${this.config.accountId}.r2.cloudflarestorage.com/${this.config.bucketName}/${key}`
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      const client = await this.getClient()
      const fileBuffer = await toBuffer(options.file)
      const key = this.getS3Key(options.folder, options.filename)

      const { s3ClientModule } = await loadS3Modules()

      const command = new s3ClientModule.PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: options.contentType || 'application/octet-stream',
        ...(options.metadata && { Metadata: options.metadata }),
        ...(options.access === 'public' && { ACL: 'public-read' }),
      })

      await client.send(command)

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
      const client = await this.getClient()
      const { s3ClientModule } = await loadS3Modules()

      const command = new s3ClientModule.GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      })

      const response = await client.send(command)
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
      const client = await this.getClient()
      const { s3ClientModule } = await loadS3Modules()

      const command = new s3ClientModule.HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      })

      const response = await client.send(command)

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
      const client = await this.getClient()
      const { s3ClientModule } = await loadS3Modules()

      const command = new s3ClientModule.DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: options.key,
      })

      await client.send(command)
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
      const client = await this.getClient()
      const { s3ClientModule } = await loadS3Modules()

      const command = new s3ClientModule.ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: options.prefix,
        MaxKeys: options.limit,
      })

      const response = await client.send(command)
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
      const client = await this.getClient()
      const { s3ClientModule, presignerModule } = await loadS3Modules()

      const command = new s3ClientModule.GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      })

      const signedUrl = await presignerModule.getSignedUrl(client, command, {
        expiresIn,
      })

      return signedUrl
    } catch {
      return this.getPublicUrl(key)
    }
  }
}

export function createR2StorageProvider(): R2StorageProvider | null {
  const config: R2StorageConfig = {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
    publicDomain: process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN,
  }

  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    console.warn('[R2Storage] Missing configuration, falling back to local storage')
    return null
  }

  return new R2StorageProvider(config)
}

let r2Instance: R2StorageProvider | null = null

export function getR2StorageProvider(): R2StorageProvider | null {
  if (!r2Instance) {
    r2Instance = createR2StorageProvider()
  }
  return r2Instance
}
