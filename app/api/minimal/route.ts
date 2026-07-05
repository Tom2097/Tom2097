import { NextResponse } from 'next/server'

function withSimple(fn: any) {
  return async function (req: any) {
    return fn(req)
  }
}

async function handler() {
  return NextResponse.json({ message: 'Minimal test' })
}

export const GET = withSimple(handler);