import { NextResponse, type NextRequest } from 'next/server'

function withMiddleware(fn: (req: NextRequest) => Promise<NextResponse>) {
  return async function (req: NextRequest) {
    return fn(req)
  }
}

async function handler(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ message: 'Complex test' })
}

export const GET = withMiddleware(handler);