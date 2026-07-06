import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { getBatchStatus, getBatchResults } from '@/lib/bulk/processor'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthenticatedUser()
    const { id } = await params
    const job = getBatchStatus(id)
    if (!job) {
      return NextResponse.json({ error: 'Batch job not found' }, { status: 404 })
    }
    const results = getBatchResults(id)
    return NextResponse.json({ job, results })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
