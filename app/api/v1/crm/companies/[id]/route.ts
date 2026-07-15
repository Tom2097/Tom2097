import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getCompany, updateCompany, deleteCompany } from '@/lib/crm/engine'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const company = await getCompany(organizationId, id)
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    return NextResponse.json(company)
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

    const company = await updateCompany(organizationId, id, body)
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    return NextResponse.json(company)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const ok = await deleteCompany(organizationId, id)
    if (!ok) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
