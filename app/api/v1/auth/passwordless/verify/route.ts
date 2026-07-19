import { NextResponse, type NextRequest } from 'next/server'
import { verifyMagicLink } from '@/lib/auth/passwordless/service'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClientIp } from '@/lib/auth/audit'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { email, passcode } = await request.json()
    if (!email || !passcode) {
      return NextResponse.json({ error: 'email and passcode are required' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const ip = getClientIp(request.headers) ?? 'unknown'
    const [ipLimited, emailLimited] = await Promise.all([
      checkTenantRateLimit(`passwordless-verify-ip:${ip}`, 100, 10),
      checkTenantRateLimit(`passwordless-verify-email:${normalizedEmail}`, 20, 5),
    ])
    if (ipLimited) return ipLimited
    if (emailLimited) return emailLimited

    const userId = await verifyMagicLink(String(passcode), normalizedEmail)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired passcode' }, { status: 400 })
    }

    // The custom passcode proves control of the email, but returning a user ID
    // is not authentication. Exchange that proof for a standard Supabase SSR
    // session, keeping the generated one-time token entirely server-side.
    const db = createServiceClient()
    const { data: authUser, error: userError } = await db.auth.admin.getUserById(userId)
    if (
      userError ||
      !authUser.user?.email ||
      authUser.user.email.toLowerCase() !== normalizedEmail
    ) {
      return NextResponse.json({ error: 'Unable to authenticate account' }, { status: 503 })
    }

    const { data: link, error: linkError } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email,
    })
    const tokenHash = link.properties?.hashed_token
    if (linkError || !tokenHash || link.user?.id !== userId) {
      return NextResponse.json({ error: 'Unable to create authenticated session' }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: session, error: sessionError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (sessionError || !session.session || session.user?.id !== userId) {
      await supabase.auth.signOut()
      return NextResponse.json({ error: 'Unable to create authenticated session' }, { status: 503 })
    }

    return NextResponse.json({ userId })
  } catch (error) {
    console.error('[passwordless/verify] verification failed', error)
    return NextResponse.json({ error: 'Failed to verify passcode' }, { status: 500 })
  }
}
