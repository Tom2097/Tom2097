import { NextResponse } from 'next/server'
import { runDueChecks } from '@/lib/monitoring/engine'

export async function POST() {
  try {
    const summary = await runDueChecks()
    return NextResponse.json({ success: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Monitor scan failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
