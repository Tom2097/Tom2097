import { NextResponse, type NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  return NextResponse.json({ message: 'Feature flags test' })
}