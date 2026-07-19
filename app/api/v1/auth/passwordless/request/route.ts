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
    const limited = await checkTenantRateLimit(`passwordless-request-ip:${ip}`, 30, 5)
    if (limited) return limited

    await sendMagicLink({ email, redirectTo })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof PasswordlessError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to send passcode' }, { status: 500 })
  }
}
