import { NextResponse, type NextRequest } from 'next/server'
import { verifyWebAuthnRegistrationResponse, registerWebAuthnCredential } from '@/lib/auth/webauthn/service'

export async function POST(request: NextRequest) {
  try {
    const { email, userId, credential, deviceName } = await request.json()
    if (!email || !userId || !credential) {
      return NextResponse.json({ error: 'email, userId, and credential are required' }, { status: 400 })
    }

    const result = await verifyWebAuthnRegistrationResponse(email, credential)
    if (!result.verified || !result.credential) {
      return NextResponse.json({ error: result.error || 'Verification failed' }, { status: 400 })
    }

    const saved = await registerWebAuthnCredential({
      userId,
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
  } catch {
    return NextResponse.json({ error: 'Failed to verify device' }, { status: 500 })
  }
}
