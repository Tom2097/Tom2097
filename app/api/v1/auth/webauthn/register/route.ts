import { NextResponse, type NextRequest } from 'next/server'
import { createWebAuthnRegistrationOptions } from '@/lib/auth/webauthn/service'

export async function POST(request: NextRequest) {
  try {
    const { email, userId } = await request.json()
    if (!email || !userId) {
      return NextResponse.json({ error: 'email and userId are required' }, { status: 400 })
    }

    const options = await createWebAuthnRegistrationOptions(userId, email)
    return NextResponse.json(options)
  } catch {
    return NextResponse.json({ error: 'Failed to start device registration' }, { status: 500 })
  }
}
