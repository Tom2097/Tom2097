import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { processDocument } from '@/lib/document-processing/advanced'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const documentId = params.id
    const { options } = await request.json()
    
    const success = await processDocument(organizationId, user.id, documentId, options)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to process document' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}