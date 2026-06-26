import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { withRateLimit, withValidation, DEFAULT_RATE_LIMITS } from '@/lib/middleware'
import { z } from 'zod'
import { storage } from '@/lib/services/storage'

/**
 * GET /api/v1/files/:key
 * Get file info or download file
 */
export const GET = withAuth(
  withRateLimit(
    withValidation(
      async (request, context) => {
        const { validatedParams } = context
        const key = validatedParams?.key as string
        const { searchParams } = new URL(request.url)
        const download = searchParams.get('download') === 'true'

        if (!key) {
          return NextResponse.json(
            { error: { code: 'MISSING_KEY', message: 'File key is required' } },
            { status: 400 }
          )
        }

        try {
          if (download) {
            // Download the file
            const fileBuffer = await storage.download(key)

            if (!fileBuffer) {
              return NextResponse.json(
                { error: { code: 'FILE_NOT_FOUND', message: 'File not found' } },
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
          } else {
            // Get file info
            const fileInfo = await storage.getFileInfo(key)

            if (!fileInfo) {
              return NextResponse.json(
                { error: { code: 'FILE_NOT_FOUND', message: 'File not found' } },
                { status: 404 }
              )
            }

            return NextResponse.json({ success: true, data: fileInfo })
          }
        } catch (error) {
          console.error('[Files] Error:', error)
          return NextResponse.json(
            {
              error: {
                code: 'FILE_ERROR',
                message: error instanceof Error ? error.message : 'File operation failed',
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
export const DELETE = withAuth(
  withRateLimit(
    withValidation(
      async (request, context) => {
        const { validatedParams } = context
        const key = validatedParams?.key as string

        if (!key) {
          return NextResponse.json(
            { error: { code: 'MISSING_KEY', message: 'File key is required' } },
            { status: 400 }
          )
        }

        try {
          const result = await storage.delete(key, false)

          if (!result) {
            return NextResponse.json(
              { error: { code: 'DELETE_FAILED', message: 'Failed to delete file' } },
              { status: 500 }
            )
          }

          return NextResponse.json({
            success: true,
            message: 'File deleted successfully',
          })
        } catch (error) {
          console.error('[Files] Delete error:', error)
          return NextResponse.json(
            {
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
