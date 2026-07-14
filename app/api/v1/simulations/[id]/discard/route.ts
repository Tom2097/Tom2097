import { NextResponse } from 'next/server'
import { discardSimulation } from '@/lib/simulation/workspace-simulator'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await discardSimulation(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to discard simulation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
