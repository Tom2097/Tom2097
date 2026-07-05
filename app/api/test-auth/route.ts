import { type NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/with-auth'

async function handler(_req: NextRequest, ctx: AuthContext) {
  return NextResponse.json({
    message: 'Test auth route',
    organizationId: ctx.organizationId
  })
}

export const GET = withAuth(handler);