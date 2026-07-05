import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'

export async function GET(_req: NextRequest) {
  const handler = async (_req: NextRequest, { organizationId }: { organizationId: string }) => {
    return NextResponse.json({ message: 'Direct test', organizationId })
  }
  
  const wrappedHandler = withAuth(handler)
  return wrappedHandler(_req)
}