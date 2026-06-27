import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/with-auth'
import { withRateLimit, withValidation, DEFAULT_RATE_LIMITS } from '@/lib/middleware'
import { z } from 'zod'
import { getSessionService } from '@/lib/auth/session'
import type { ActiveSession } from '@/lib/auth/session/types'

/**
 * GET /api/v1/sessions
 * List all active sessions for the authenticated user
 */
export const GET = withAuth(
  withRateLimit(
    async (request: NextRequest, context) => {
      const sessionService = getSessionService()
      const userId = (context as AuthContext).userId

      try {
        const sessions = await sessionService.getUserSessions(userId)
        
        // Remove JWT tokens from response (security)
        const safeSessions = sessions.map((s: ActiveSession) => ({
          id: s.id,
          userId: s.userId,
          organizationId: s.organizationId,
          ipAddress: s.ipAddress,
          deviceType: s.deviceType,
          createdAt: s.createdAt.toISOString(),
          lastActivityAt: s.lastActivityAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          isActive: s.isActive,
          location: s.location,
          isCurrent: false, // Would need to check against current session
        }))

        return NextResponse.json({
          success: true,
          data: safeSessions,
        })
      } catch (error) {
        console.error('[Sessions] Get error:', error)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'GET_SESSIONS_FAILED',
              message: error instanceof Error ? error.message : 'Failed to get sessions',
            },
          },
          { status: 500 }
        )
      }
    },
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['sessions:read'] }
)

/**
 * Session creation schema
 */
const sessionCreateSchema = z.object({
  // Empty for now - sessions are created automatically on login
})

/**
 * POST /api/v1/sessions
 * Create a new session (typically called during login)
 */
export const POST = withAuth(
  withRateLimit(
    withValidation(
      async (request: NextRequest, context) => {
        const sessionService = getSessionService()
        const userId = (context as AuthContext & { validatedBody?: Record<string, unknown> }).userId

        try {
          const session = await sessionService.createSession(request, userId, context.organizationId)

          return NextResponse.json({
            success: true,
            data: {
              id: session.id,
              jwt: session.jwt,
              expiresAt: session.expiresAt.toISOString(),
            },
          })
        } catch (error) {
          console.error('[Sessions] Create error:', error)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'CREATE_SESSION_FAILED',
                message: error instanceof Error ? error.message : 'Failed to create session',
              },
            },
            { status: error instanceof Error && error.name === 'SessionError' ? 400 : 500 }
          )
        }
      },
      { body: sessionCreateSchema }
    ),
    DEFAULT_RATE_LIMITS.auth
  ),
  { requireAll: ['sessions:write'] }
)

/**
 * DELETE /api/v1/sessions
 * Revoke all sessions for the authenticated user (except current)
 */
export const DELETE = withAuth(
  withRateLimit(
    async (request: NextRequest, context) => {
      const sessionService = getSessionService()
      const userId = (context as AuthContext).userId

      const currentSessionId = (context as unknown as Record<string, string>).sessionId ?? ''

      try {
        // Revoke all sessions except the current one
        const count = await sessionService.revokeOtherSessions(
          userId,
          currentSessionId || ''
        )

        return NextResponse.json({
          success: true,
          message: `Revoked ${count} other sessions`,
          data: { revokedCount: count },
        })
      } catch (error) {
        console.error('[Sessions] Revoke error:', error)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'REVOKE_FAILED',
              message: error instanceof Error ? error.message : 'Failed to revoke sessions',
            },
          },
          { status: 500 }
        )
      }
    },
    DEFAULT_RATE_LIMITS.api
  ),
  { requireAll: ['sessions:delete'] }
)
