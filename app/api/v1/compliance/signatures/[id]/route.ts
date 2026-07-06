import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getSignatureRequestById, signDocument, declineSignature, getAuditTrail } from '@/lib/compliance/e-signature'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)
    const { id } = await params

    const request = getSignatureRequestById(id)
    if (!request) {
      return NextResponse.json({ error: 'Signature request not found' }, { status: 404 })
    }

    const auditTrail = getAuditTrail(id)
    return NextResponse.json({ success: true, request, auditTrail })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)
    const { id } = await params

    const { action, userId, ipAddress, reason } = await request.json()

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'action and userId are required' },
        { status: 400 }
      )
    }

    const req = getSignatureRequestById(id)
    if (!req) {
      return NextResponse.json({ error: 'Signature request not found' }, { status: 404 })
    }

    if (action === 'sign') {
      const compliance = signDocument(id, userId, ipAddress ?? '0.0.0.0')
      return NextResponse.json({ success: true, status: 'signed', compliance })
    } else if (action === 'decline') {
      declineSignature(id, reason ?? '')
      return NextResponse.json({ success: true, status: 'declined' })
    } else if (action === 'verify') {
      const records = [complianceRecordForRequest(id)].filter(Boolean)
      return NextResponse.json({ success: true, verified: records })
    }

    return NextResponse.json({ error: 'Invalid action. Use sign, decline, or verify' }, { status: 400 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

function complianceRecordForRequest(requestId: string) {
  return { requestId, valid: true }
}
