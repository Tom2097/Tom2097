import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createSignatureRequest, getSignatureRequests } from '@/lib/compliance/e-signature'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId') ?? organizationId

    const requests = getSignatureRequests(orgId)
    return NextResponse.json({ success: true, requests })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)

    const { documentId, documentName, signerEmail, signerName } = await request.json()

    if (!documentId || !documentName || !signerEmail || !signerName) {
      return NextResponse.json(
        { error: 'documentId, documentName, signerEmail, and signerName are required' },
        { status: 400 }
      )
    }

    const signatureRequest = createSignatureRequest(documentId, documentName, signerEmail, signerName)
    return NextResponse.json({ success: true, request: signatureRequest })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
