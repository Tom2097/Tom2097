// Type definitions for AWS SDK v3
// Minimal declarations for S3 client usage

declare module '@aws-sdk/client-s3' {
  export interface S3ClientConfig {
    region?: string
    credentials?: {
      accessKeyId: string
      secretAccessKey: string
    }
    endpoint?: string
    forcePathStyle?: boolean
  }

  export class S3Client {
    constructor(config: S3ClientConfig)
  }

  export interface PutObjectCommandInput {
    Bucket: string
    Key: string
    Body: string | Uint8Array | Buffer | Readable
    ContentType?: string
    ACL?: 'private' | 'public-read'
    Metadata?: Record<string, string>
  }

  export class PutObjectCommand {
    constructor(input: PutObjectCommandInput)
  }

  export interface GetObjectCommandInput {
    Bucket: string
    Key: string
  }

  export class GetObjectCommand {
    constructor(input: GetObjectCommandInput)
  }

  export interface DeleteObjectCommandInput {
    Bucket: string
    Key: string
  }

  export class DeleteObjectCommand {
    constructor(input: DeleteObjectCommandInput)
  }

  export interface ListObjectsV2CommandInput {
    Bucket: string
    Prefix?: string
    MaxKeys?: number
  }

  export class ListObjectsV2Command {
    constructor(input: ListObjectsV2CommandInput)
  }

  export interface ListObjectsV2CommandOutput {
    Contents?: Array<{
      Key: string
      Size: number
      LastModified: Date
      ETag: string
    }>
    IsTruncated?: boolean
    NextContinuationToken?: string
  }

  export class S3 {
    send(command: PutObjectCommand): Promise<{ ETag: string }>
    send(command: GetObjectCommand): Promise<{ Body: Readable }>
    send(command: DeleteObjectCommand): Promise<{}>
    send(command: ListObjectsV2Command): Promise<ListObjectsV2CommandOutput>
  }
}