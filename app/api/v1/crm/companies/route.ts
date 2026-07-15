import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createCompany, getCompanyHierarchy, validateCompany } from '@/lib/crm/engine'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const companies = await getCompanyHierarchy(organizationId, {
      search: searchParams.get('search') || undefined,
      limit: Number(searchParams.get('limit')) || 50,
    })
    return NextResponse.json({ companies })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const input = await request.json()
    const validationError = validateCompany(input)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const company = await createCompany(organizationId, user.id, input)
    return NextResponse.json(company, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
