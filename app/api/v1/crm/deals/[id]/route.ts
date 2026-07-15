import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getDeal, updateDeal, deleteDeal } from '@/lib/crm/engine'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const deal = await getDeal(organizationId, id)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return NextResponse.json({ deal })
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

    const deal = await updateDeal(organizationId, id, body)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return NextResponse.json({ deal })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const ok = await deleteDeal(organizationId, id)
    if (!ok) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
