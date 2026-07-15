import { NextResponse, type NextRequest } from 'next/server'
import { verifyMagicLink } from '@/lib/auth/passwordless/service'

export async function POST(request: NextRequest) {
  try {
    const { email, passcode } = await request.json()
    if (!email || !passcode) {
      return NextResponse.json({ error: 'email and passcode are required' }, { status: 400 })
    }

    const userId = await verifyMagicLink(passcode, email)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired passcode' }, { status: 400 })
    }

    return NextResponse.json({ userId })
  } catch {
    return NextResponse.json({ error: 'Failed to verify passcode' }, { status: 500 })
  }
}
