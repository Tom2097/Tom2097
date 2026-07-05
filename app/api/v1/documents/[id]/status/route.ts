import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getDocumentProcessingStatus } from '@/lib/document-processing/advanced'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const documentId = params.id
    
    const status = await getDocumentProcessingStatus(documentId, organizationId)
    
    return NextResponse.json({
      success: true,
      status
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}