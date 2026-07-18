import { NextResponse, type NextRequest } from 'next/server'
import { verifyWebAuthnRegistrationResponse, registerWebAuthnCredential } from '@/lib/auth/webauthn/service'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const { credential, deviceName } = await request.json()
    if (!user.email) {
      return NextResponse.json({ error: 'The authenticated account does not have an email address' }, { status: 400 })
    }
    if (!credential) {
      return NextResponse.json({ error: 'credential is required' }, { status: 400 })
    }

    const result = await verifyWebAuthnRegistrationResponse(user.email, credential)
    if (!result.verified || !result.credential) {
      return NextResponse.json({ error: result.error || 'Verification failed' }, { status: 400 })
    }

    const saved = await registerWebAuthnCredential({
      userId: user.id,
      credential: {
        id: result.credential.id,
        publicKey: result.credential.publicKey,
        counter: result.credential.counter,
        deviceType: credential.type ?? 'public-key',
        transports: credential.response?.transports ?? [],
      },
      deviceName,
    })

    if (!saved.success) {
      return NextResponse.json({ error: saved.error || 'Failed to save device' }, { status: 500 })
    }

    return NextResponse.json({ success: true, counter: result.credential.counter })
  } catch (error) {
    if (error instanceof Error && ['Unauthorized', 'Suspended'].includes(error.message)) {
      return handleAuthError(error)
    }
    return NextResponse.json({ error: 'Failed to verify device' }, { status: 500 })
  }
}
