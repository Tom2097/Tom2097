import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createContact, listContacts, updateContact, deleteContact, validateContact } from '@/lib/crm/engine'
import { recordCrmEvent } from '@/lib/crm/smart-layer'
import type { ContactStatus } from '@/lib/crm/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { contacts, total } = await listContacts(organizationId, {
      status: (searchParams.get('status') as ContactStatus) || undefined,
      companyId: searchParams.get('companyId') || undefined,
      search: searchParams.get('search') || undefined,
      limit: Number(searchParams.get('limit')) || 50,
      offset: Number(searchParams.get('offset')) || 0,
    })
    return NextResponse.json({ contacts, total })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const input = await request.json()
    const validationError = validateContact(input)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const contact = await createContact(organizationId, user.id, input)
    await recordCrmEvent(organizationId, 'contact_created', { contactId: contact.id })
    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const body = await request.json()
    const id = searchParams.get('id') || body.id
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const contact = await updateContact(organizationId, id, body)
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    return NextResponse.json(contact)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const ok = await deleteContact(organizationId, id)
    if (!ok) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
