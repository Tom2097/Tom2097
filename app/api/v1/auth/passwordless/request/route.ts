import { NextResponse, type NextRequest } from 'next/server'
import { sendMagicLink } from '@/lib/auth/passwordless/service'
import { PasswordlessError } from '@/lib/auth/passwordless/types'
import { getClientIp } from '@/lib/auth/audit'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { email, redirectTo } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const ip = getClientIp(request.headers) ?? 'unknown'
    const normalizedEmail = email.trim().toLowerCase()
    const ipLimited = await checkTenantRateLimit(`passwordless-request-ip:${ip}`, 30, 5)
    if (ipLimited) return ipLimited
    const emailLimited = await checkTenantRateLimit(`passwordless-request-email:${normalizedEmail}`, 60, 3)
    if (emailLimited) return emailLimited

    await sendMagicLink({ email, redirectTo })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof PasswordlessError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to send passcode' }, { status: 500 })
  }
}
