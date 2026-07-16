import { NextResponse, type NextRequest } from 'next/server'
import { resolveMx, resolve4 } from 'node:dns/promises'

const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i

// Confirms the domain is a real, resolvable one -- a genuine DNS lookup,
// not a fabricated pass/fail.
export async function POST(request: NextRequest) {
  try {
    const { domain } = await request.json()
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!DOMAIN_PATTERN.test(normalized)) {
      return NextResponse.json({ verified: false, reason: 'Invalid domain format' })
    }

    try {
      await resolveMx(normalized)
      return NextResponse.json({ verified: true, domain: normalized })
    } catch {
      try {
        await resolve4(normalized)
        return NextResponse.json({ verified: true, domain: normalized })
      } catch {
        return NextResponse.json({ verified: false, reason: 'Domain does not resolve' })
      }
    }
  } catch {
    return NextResponse.json({ error: 'Failed to verify domain' }, { status: 500 })
  }
}
