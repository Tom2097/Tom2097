import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getContact, updateContact, deleteContact } from '@/lib/crm/engine'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const contact = await getContact(organizationId, id)
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    return NextResponse.json(contact)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params
    const body = await request.json()

    const contact = await updateContact(organizationId, id, body)
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    return NextResponse.json(contact)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const ok = await deleteContact(organizationId, id)
    if (!ok) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
