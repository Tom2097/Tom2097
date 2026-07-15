import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createTemplate, listTemplates } from '@/lib/crm/extensions'
import type { CommunicationChannel } from '@/lib/crm/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { templates } = await listTemplates(organizationId, {
      channel: (searchParams.get('channel') as CommunicationChannel) || undefined,
      category: searchParams.get('category') || undefined,
    })
    return NextResponse.json({ templates })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const input = await request.json()
    if (!input.name || !input.channel || !input.subject || !input.body) {
      return NextResponse.json({ error: 'name, channel, subject, and body are required' }, { status: 400 })
    }

    const template = await createTemplate(organizationId, input)
    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
