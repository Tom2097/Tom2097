import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { verify2FACode, twoFARateLimiter } from '@/lib/auth/2fa'

/**
 * POST /api/v1/auth/2fa/disable
 * Body: { code: string }
 * Requires a valid TOTP or backup code before turning 2FA off -- otherwise
 * anyone with a hijacked session (but not the authenticator) could disable
 * the account's second factor.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    let body: { code?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const code = body.code?.trim()
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const rateLimit = twoFARateLimiter.canAttempt(user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many attempts. Try again later.',
          lockedUntil: rateLimit.lockedUntil?.toISOString(),
        },
        { status: 429 }
      )
    }

    const db = createServiceClient()
    const { data: profile } = await db
      .from('profiles')
      .select('totp_secret, totp_enabled, totp_backup_codes')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.totp_enabled || !profile.totp_secret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 })
    }

    const result = verify2FACode(code, profile.totp_secret, profile.totp_backup_codes ?? [])
    if (!result.valid) {
      twoFARateLimiter.recordAttempt(user.id)
      return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
    }

    twoFARateLimiter.clearAttempts(user.id)

    const { error } = await db
      .from('profiles')
      .update({
        totp_secret: null,
        totp_pending_secret: null,
        totp_enabled: false,
        totp_backup_codes: [],
        totp_confirmed_at: null,
      })
      .eq('id', user.id)

    if (error) {
      console.error('[2FA] Failed to disable 2FA:', error)
      return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 })
    }

    return NextResponse.json({ success: true, enabled: false })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
