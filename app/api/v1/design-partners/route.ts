import { NextResponse } from 'next/server'
import { listPartners } from '@/lib/design-partner/partners'

export async function GET() {
  try {
    const partners = listPartners()
    return NextResponse.json({ partners })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load design partners'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
