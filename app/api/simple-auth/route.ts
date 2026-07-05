import { NextResponse } from 'next/server'
import { withSimpleAuth } from '@/lib/auth/simple-with-auth'

async function handler() {
  return NextResponse.json({ message: 'Simple auth test' })
}

export const GET = withSimpleAuth(handler);