import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getBatchStatus, getBatchResults } from '@/lib/bulk/processor'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const orgId = await getOrganizationId(user.id)
    const { id } = await params
    const job = await getBatchStatus(orgId, id)
    if (!job) {
      return NextResponse.json({ error: 'Batch job not found' }, { status: 404 })
    }
    const results = await getBatchResults(orgId, id)
    return NextResponse.json({ job, results })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
