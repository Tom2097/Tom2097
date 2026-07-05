import { NextResponse, type NextRequest } from 'next/server'

export function withSimpleAuth(fn: any) {
  return async function (req: NextRequest) {
    // Simple auth check
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Call the original function
    return fn(req)
  }
}