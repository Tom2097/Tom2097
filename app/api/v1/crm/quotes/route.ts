import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createQuote, listQuotes, updateQuoteStatus } from '@/lib/crm/extensions'
import { createServiceClient } from '@/lib/supabase/service'
import type { QuoteStatus } from '@/lib/crm/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { quotes } = await listQuotes(organizationId, {
      status: (searchParams.get('status') as QuoteStatus) || undefined,
      dealId: searchParams.get('dealId') || undefined,
      limit: Number(searchParams.get('limit')) || 50,
    })

    const contactIds = [...new Set(quotes.map((q) => q.contact_id).filter(Boolean))] as string[]
    const companyIds = [...new Set(quotes.map((q) => q.company_id).filter(Boolean))] as string[]
    const db = createServiceClient()
    const [{ data: contacts }, { data: companies }] = await Promise.all([
      contactIds.length ? db.from('crm_contacts').select('id,first_name,last_name').in('id', contactIds) : Promise.resolve({ data: [] }),
      companyIds.length ? db.from('crm_companies').select('id,name').in('id', companyIds) : Promise.resolve({ data: [] }),
    ])
    const contactName = new Map((contacts ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]))
    const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]))

    return NextResponse.json({
      quotes: quotes.map((q) => ({
        id: q.id,
        title: q.title,
        status: q.status,
        value: q.value,
        currency: q.currency,
        contact: q.contact_id ? contactName.get(q.contact_id) ?? '' : '',
        company: q.company_id ? companyName.get(q.company_id) ?? '' : '',
        valid_until: q.valid_until,
        created_at: q.created_at,
      })),
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const input = await request.json()
    if (!input.title || typeof input.title !== 'string' || !input.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const quote = await createQuote(organizationId, user.id, input)
    return NextResponse.json(quote, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { status } = await request.json()
    const quote = await updateQuoteStatus(organizationId, id, status)
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    return NextResponse.json(quote)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
