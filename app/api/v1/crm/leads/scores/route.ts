import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { listContacts } from '@/lib/crm/engine'
import { computeLeadScore } from '@/lib/crm/extensions'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/v1/crm/leads/scores - compute (and persist) scores for every lead contact
// GET /api/v1/crm/leads/scores?priority=true - only score >= 70
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)
    const priorityOnly = searchParams.get('priority') === 'true'

    const { contacts } = await listContacts(organizationId, { status: 'lead', limit: 200 })
    const db = createServiceClient()

    const scored = await Promise.all(
      contacts.map(async (contact) => {
        const result = computeLeadScore(contact)
        await db
          .from('crm_lead_scores')
          .upsert(
            { contact_id: contact.id, organization_id: organizationId, score: result.score, factors: result.factors, last_updated: result.last_updated },
            { onConflict: 'contact_id' },
          )
        return { contact_id: contact.id, score: result.score, factors: result.factors, last_updated: result.last_updated }
      }),
    )

    return NextResponse.json(priorityOnly ? scored.filter((s) => s.score >= 70) : scored)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

// POST /api/v1/crm/leads/scores - compute and persist the score for a single contact
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { contact_id } = await request.json()
    if (!contact_id) return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })

    const db = createServiceClient()
    const { data: contact, error: contactError } = await db
      .from('crm_contacts')
      .select('*')
      .eq('id', contact_id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (contactError || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const result = computeLeadScore(contact)
    await db
      .from('crm_lead_scores')
      .upsert(
        { contact_id, organization_id: organizationId, score: result.score, factors: result.factors, last_updated: result.last_updated },
        { onConflict: 'contact_id' },
      )

    return NextResponse.json({ contact_id, score: result.score, factors: result.factors, last_updated: result.last_updated })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
