import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { withRateLimit, withValidation, DEFAULT_RATE_LIMITS } from '@/lib/middleware'
import { z } from 'zod'
import { storage, validateFileType, DEFAULT_FILE_TYPES, StorageError } from '@/lib/services/storage'

/**
 * File upload request schema
 */
const uploadSchema = z.object({
  folder: z.string().optional(),
  access: z.enum(['public', 'private']).default('private'),
  metadata: z.record(z.string()).optional(),
})

/**
 * File upload response
 */
interface FileUploadResponse {
  success: boolean
  data?: {
    key: string
    url: string
    size: number
    contentType: string
    filename: string
  }
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * GET /api/v1/files
 * List files with optional prefix filtering
 */
export const GET = withAuth(
  withRateLimit(
    withValidation(
      async (request, context) => {
        const { validatedQuery } = context
        const { prefix, limit } = validatedQuery || {}

        try {
          const files = await storage.list({
            prefix: prefix as string | undefined,
            limit: limit ? Number(limit) : undefined,
          })

          return NextResponse.json({
            success: true,
            data: files,
          })
        } catch (error) {
          console.error('[Files] List error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'LIST_ERROR',
                message: error instanceof Error ? error.message : 'Failed to list files',
              },
            },
            { status: 500 }
          )
        }
      },
      {
        query: z.object({
          prefix: z.string().optional(),
          limit: z.string().regex(/^\d+$/).transform(Number).optional(),
        }),
      }
    ),
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['files:read'] }
)

/**
 * POST /api/v1/files
 * Upload a new file
 */
export const POST = withAuth(
  withRateLimit(
    withValidation(
      async (request) => {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const rawBody = await request.json().catch(() => ({}))
        
        // Try to get folder, access, metadata from either form data or JSON body
        const folder = formData.get('folder') as string | undefined || rawBody?.folder
        const access = formData.get('access') as 'public' | 'private' | undefined || rawBody?.access || 'private'
        const metadata = rawBody?.metadata || {}

        if (!file && !formData.has('file')) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'NO_FILE',
                message: 'No file provided in request',
              },
            },
            { status: 400 }
          )
        }

        // Validate file
        const fileValidation = validateFileType(
          {
            name: file?.name || 'unknown',
            size: file?.size || 0,
            type: file?.type || '',
          },
          DEFAULT_FILE_TYPES.any
        )

        if (!fileValidation.valid && fileValidation.error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: fileValidation.error.code,
                message: fileValidation.error.message,
                details: fileValidation.error.details,
              },
            },
            { status: 400 }
          )
        }

        try {
          // Convert File to Buffer
          const fileBuffer = Buffer.from(await file!.arrayBuffer())

          const result = await storage.upload({
            file: fileBuffer,
            filename: file!.name,
            contentType: file!.type || 'application/octet-stream',
            folder,
            access,
            metadata,
          })

          if (!result.success) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'UPLOAD_FAILED',
                  message: result.error || 'File upload failed',
                },
              },
              { status: 500 }
            )
          }

          return NextResponse.json<FileUploadResponse>({
            success: true,
            data: {
              key: result.key,
              url: result.url || '',
              size: result.size,
              contentType: result.contentType,
              filename: file!.name,
            },
          })
        } catch (error) {
          console.error('[Files] Upload error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'UPLOAD_ERROR',
                message: error instanceof Error ? error.message : 'File upload failed',
              },
            },
            { status: 500 }
          )
        }
      },
      { body: uploadSchema }
    ),
    DEFAULT_RATE_LIMITS.upload
  ),
  { requireAll: ['files:write'] }
)

/**
 * GET /api/v1/files/:key
 * Get file metadata
 */
export const GET_file = withAuth(
  withRateLimit(
    withValidation(
      async (request, context) => {
        const { validatedParams } = context
        const key = validatedParams?.key as string

        if (!key) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'MISSING_KEY', message: 'File key is required' },
            },
            { status: 400 }
          )
        }

        try {
          const fileInfo = await storage.getFileInfo(key)

          if (!fileInfo) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'FILE_NOT_FOUND', message: 'File not found' },
              },
              { status: 404 }
            )
          }

          return NextResponse.json({
            success: true,
            data: fileInfo,
          })
        } catch (error) {
          console.error('[Files] Get info error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'GET_INFO_ERROR',
                message: error instanceof Error ? error.message : 'Failed to get file info',
              },
            },
            { status: 500 }
          )
        }
      },
      {
        params: z.object({
          key: z.string(),
        }),
      }
    ),
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['files:read'] }
)

/**
 * DELETE /api/v1/files/:key
 * Delete a file
 */
export const DELETE_file = withAuth(
  withRateLimit(
    withValidation(
      async (request, context) => {
        const { validatedParams } = context
        const key = validatedParams?.key as string

        if (!key) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'MISSING_KEY', message: 'File key is required' },
            },
            { status: 400 }
          )
        }

        try {
          const result = await storage.delete(key, false)

          if (!result) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'DELETE_FAILED', message: 'Failed to delete file' },
              },
              { status: 500 }
            )
          }

          return NextResponse.json({
            success: true,
            message: 'File deleted successfully',
          })
        } catch (error) {
          if (error instanceof StorageError) {
            return NextResponse.json(
              {
                success: false,
                error: { code: error.code, message: error.message },
              },
              { status: error.code === 'FILE_NOT_FOUND' ? 404 : 500 }
            )
          }

          console.error('[Files] Delete error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'DELETE_ERROR',
                message: error instanceof Error ? error.message : 'Failed to delete file',
              },
            },
            { status: 500 }
          )
        }
      },
      {
        params: z.object({
          key: z.string(),
        }),
      }
    ),
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['files:delete'] }
)

/**
 * GET /api/v1/files/:key/download
 * Download a file
 */
export const GET_download = withAuth(
  withRateLimit(
    withValidation(
      async (request, context) => {
        const { validatedParams } = context
        const key = validatedParams?.key as string

        if (!key) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'MISSING_KEY', message: 'File key is required' },
            },
            { status: 400 }
          )
        }

        try {
          const fileBuffer = await storage.download(key)

          if (!fileBuffer) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'FILE_NOT_FOUND', message: 'File not found' },
              },
              { status: 404 }
            )
          }

          const fileInfo = await storage.getFileInfo(key)

          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': fileInfo?.contentType || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${fileInfo?.filename || key}"`,
              'Content-Length': fileBuffer.length.toString(),
            },
          })
        } catch (error) {
          console.error('[Files] Download error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'DOWNLOAD_ERROR',
                message: error instanceof Error ? error.message : 'Failed to download file',
              },
            },
            { status: 500 }
          )
        }
      },
      {
        params: z.object({
          key: z.string(),
        }),
      }
    ),
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['files:read'] }
)
