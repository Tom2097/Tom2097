import { NextResponse } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { generateTOTPSetup } from '@/lib/auth/2fa'

/**
 * POST /api/v1/auth/2fa/setup
 * Generates a new TOTP secret + QR code and backup codes, and stores the
 * secret/hashed backup codes as *pending* (not yet enabled) until the user
 * confirms possession of the authenticator via /verify.
 */
export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    const db = createServiceClient()

    const { data: profile } = await db
      .from('profiles')
      .select('totp_enabled')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.totp_enabled) {
      return NextResponse.json(
        { error: '2FA is already enabled. Disable it before setting up again.' },
        { status: 400 }
      )
    }

    const setup = await generateTOTPSetup('DigiT', user.email || user.id)

    const { error } = await db
      .from('profiles')
      .update({
        totp_pending_secret: setup.secret,
        totp_backup_codes: setup.hashedBackupCodes,
      })
      .eq('id', user.id)

    if (error) {
      console.error('[2FA] Failed to store pending TOTP secret:', error)
      return NextResponse.json({ error: 'Failed to start 2FA setup' }, { status: 500 })
    }

    // Backup codes and the raw secret/QR are only ever shown once, here.
    return NextResponse.json({
      secret: setup.secret,
      uri: setup.uri,
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
