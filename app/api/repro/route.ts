import { NextResponse, type NextRequest } from 'next/server'

function withMiddleware(fn: any) {
  return async function (req: NextRequest) {
    return fn(req)
  }
}

async function handler(_req: NextRequest) {
  return NextResponse.json({ message: 'Repro test' })
}

export const GET = withMiddleware(handler);