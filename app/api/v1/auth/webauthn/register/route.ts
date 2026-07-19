import { NextResponse } from 'next/server'
import { createWebAuthnRegistrationOptions } from '@/lib/auth/webauthn/service'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'

export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    if (!user.email) {
      return NextResponse.json({ error: 'The authenticated account does not have an email address' }, { status: 400 })
    }

    const options = await createWebAuthnRegistrationOptions(user.id, user.email)
    return NextResponse.json(options)
  } catch (error) {
    if (error instanceof Error && ['Unauthorized', 'Suspended'].includes(error.message)) {
      return handleAuthError(error)
    }
    return NextResponse.json({ error: 'Failed to start device registration' }, { status: 500 })
  }
}
