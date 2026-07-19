import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { verify2FACode, twoFARateLimiter } from '@/lib/auth/2fa'

/**
 * POST /api/v1/auth/2fa/verify
 * Body: { code: string }
 *
 * Verifies a TOTP or backup code against the user's stored secret.
 * - If 2FA isn't enabled yet, this confirms the pending secret from /setup
 *   and turns 2FA on.
 * - If 2FA is already enabled, this is a plain verification (e.g. a
 *   step-up challenge) and consumes the backup code if one was used.
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
      .select('totp_secret, totp_pending_secret, totp_enabled, totp_backup_codes')
      .eq('id', user.id)
      .maybeSingle()

    const isConfirmingSetup = !profile?.totp_enabled && !!profile?.totp_pending_secret
    const secret = isConfirmingSetup ? profile?.totp_pending_secret : profile?.totp_secret

    if (!secret) {
      return NextResponse.json(
        { error: 'No 2FA setup in progress. Call /setup first.' },
        { status: 400 }
      )
    }

    const hashedBackupCodes: string[] = profile?.totp_backup_codes ?? []
    const result = verify2FACode(code, secret, hashedBackupCodes)

    if (!result.valid) {
      twoFARateLimiter.recordAttempt(user.id)
      return NextResponse.json({ error: 'Invalid code', valid: false }, { status: 401 })
    }

    twoFARateLimiter.clearAttempts(user.id)

    const updates: Record<string, unknown> = {}

    if (isConfirmingSetup) {
      updates.totp_secret = secret
      updates.totp_pending_secret = null
      updates.totp_enabled = true
      updates.totp_confirmed_at = new Date().toISOString()
    }

    if (result.isBackupCode && typeof result.backupCodeIndex === 'number') {
      updates.totp_backup_codes = hashedBackupCodes.filter((_, i) => i !== result.backupCodeIndex)
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await db.from('profiles').update(updates).eq('id', user.id)
      if (error) {
        console.error('[2FA] Failed to persist verification result:', error)
        return NextResponse.json({ error: 'Failed to verify 2FA code' }, { status: 500 })
      }
    }

    return NextResponse.json({
      valid: true,
      enabled: isConfirmingSetup ? true : Boolean(profile?.totp_enabled),
      usedBackupCode: result.isBackupCode,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
