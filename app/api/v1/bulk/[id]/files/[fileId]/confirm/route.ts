import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { processUploadedFile } from '@/lib/bulk/processor'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const orgId = await getOrganizationId(user.id)
    const { id, fileId } = await params
    await processUploadedFile(orgId, id, fileId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
