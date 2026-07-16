import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createBatchJob, listBatches, type BatchFile } from '@/lib/bulk/processor'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const orgId = await getOrganizationId(user.id)
    const body = await request.json()
    const { files } = body as { files: BatchFile[] }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'Missing required field: files (non-empty array)' }, { status: 400 })
    }
    const result = await createBatchJob(orgId, user.id, files)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const orgId = await getOrganizationId(user.id)
    const batches = await listBatches(orgId)
    return NextResponse.json({ batches })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
