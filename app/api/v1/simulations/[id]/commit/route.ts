import { NextResponse } from 'next/server'
import { commitSimulation } from '@/lib/simulation/workspace-simulator'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await commitSimulation(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to commit simulation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
