import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/with-auth'
import { withRateLimit, withValidation, DEFAULT_RATE_LIMITS } from '@/lib/middleware'
import { z } from 'zod'
import { getSessionService } from '@/lib/auth/session'

/**
 * GET /api/v1/sessions/:sessionId
 * Get details for a specific session
 */
export const GET = withAuth(
  withRateLimit(
    withValidation(
      async (request: NextRequest, context) => {
        const sessionService = getSessionService()
        const ctx = context as AuthContext & { validatedParams?: Record<string, unknown> }
        const sessionId = ctx.validatedParams?.sessionId as string
        const userId = ctx.userId

        if (!sessionId) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'MISSING_SESSION_ID', message: 'Session ID is required' },
            },
            { status: 400 }
          )
        }

        try {
          const session = await sessionService.getUserSessions(userId)
            .then(sessions => sessions.find(s => s.id === sessionId))

          if (!session) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
              },
              { status: 404 }
            )
          }

          return NextResponse.json({
            success: true,
            data: {
              id: session.id,
              userId: session.userId,
              organizationId: session.organizationId,
              ipAddress: session.ipAddress,
              deviceType: session.deviceType,
              createdAt: session.createdAt.toISOString(),
              lastActivityAt: session.lastActivityAt.toISOString(),
              expiresAt: session.expiresAt.toISOString(),
              isActive: session.isActive,
              location: session.location,
            },
          })
        } catch (error) {
          console.error('[Sessions] Get session error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'GET_SESSION_FAILED',
                message: error instanceof Error ? error.message : 'Failed to get session',
              },
            },
            { status: 500 }
          )
        }
      },
      {
        params: z.object({
          sessionId: z.string(),
        }),
      }
    ),
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['sessions:read'] }
)

/**
 * DELETE /api/v1/sessions/:sessionId
 * Revoke a specific session
 */
export const DELETE = withAuth(
  withRateLimit(
    withValidation(
      async (request: NextRequest, context) => {
        const sessionService = getSessionService()
        const ctx = context as AuthContext & { validatedParams?: Record<string, unknown> }
        const sessionId = ctx.validatedParams?.sessionId as string
        const userId = ctx.userId

        if (!sessionId) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'MISSING_SESSION_ID', message: 'Session ID is required' },
            },
            { status: 400 }
          )
        }

        try {
          const session = await sessionService.getUserSessions(userId)
            .then(sessions => sessions.find(s => s.id === sessionId))

          if (!session) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or does not belong to you' },
              },
              { status: 404 }
            )
          }

          const success = await sessionService.revokeSession(sessionId)

          if (!success) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'REVOKE_FAILED', message: 'Failed to revoke session' },
              },
              { status: 500 }
            )
          }

          return NextResponse.json({
            success: true,
            message: 'Session revoked successfully',
          })
        } catch (error) {
          console.error('[Sessions] Revoke session error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'REVOKE_FAILED',
                message: error instanceof Error ? error.message : 'Failed to revoke session',
              },
            },
            { status: 500 }
          )
        }
      },
      {
        params: z.object({
          sessionId: z.string(),
        }),
      }
    ),
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['sessions:delete'] }
)

/**
 * PATCH /api/v1/sessions/:sessionId/refresh
 * Refresh a specific session (extend expiration)
 */
export const PATCH = withAuth(
  withRateLimit(
    withValidation(
      async (request: NextRequest, context) => {
        const sessionService = getSessionService()
        const ctx = context as AuthContext & { validatedParams?: Record<string, unknown> }
        const sessionId = ctx.validatedParams?.sessionId as string
        const userId = ctx.userId

        if (!sessionId) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'MISSING_SESSION_ID', message: 'Session ID is required' },
            },
            { status: 400 }
          )
        }

        try {
          // Verify the session belongs to the user
          const session = await sessionService.getUserSessions(userId)
            .then(sessions => sessions.find(s => s.id === sessionId))

          if (!session) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or does not belong to you' },
              },
              { status: 404 }
            )
          }

          const refreshed = await sessionService.refreshSession(sessionId)

          if (!refreshed) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'REFRESH_FAILED', message: 'Failed to refresh session' },
              },
              { status: 500 }
            )
          }

          return NextResponse.json({
            success: true,
            data: {
              id: refreshed.id,
              jwt: refreshed.jwt,
              expiresAt: refreshed.expiresAt.toISOString(),
            },
          })
        } catch (error) {
          console.error('[Sessions] Refresh session error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'REFRESH_FAILED',
                message: error instanceof Error ? error.message : 'Failed to refresh session',
              },
            },
            { status: 500 }
          )
        }
      },
      {
        params: z.object({
          sessionId: z.string(),
        }),
      }
    ),
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['sessions:write'] }
)
