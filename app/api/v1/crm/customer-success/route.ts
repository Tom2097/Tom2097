import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { listCustomerAccounts, updateCustomerAccount } from '@/lib/crm/extensions'
import { createServiceClient } from '@/lib/supabase/service'
import { ACCOUNT_HEALTH_STATUSES, type AccountHealthStatus } from '@/lib/crm/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { accounts } = await listCustomerAccounts(organizationId, {
      healthStatus: (searchParams.get('healthStatus') as AccountHealthStatus) || undefined,
      limit: Number(searchParams.get('limit')) || 100,
    })

    const companyIds = [...new Set(accounts.map((a) => a.company_id))]
    const db = createServiceClient()
    const { data: companies } = companyIds.length
      ? await db.from('crm_companies').select('id,name').in('id', companyIds)
      : { data: [] }
    const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]))

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        company: companyName.get(a.company_id) ?? '',
        health_status: a.health_status,
        health_score: a.health_score,
        renewal_date: a.renewal_date,
        last_activity_at: a.last_activity_at,
      })),
    })
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

    const body = await request.json()
    if (body.health_status && !ACCOUNT_HEALTH_STATUSES.includes(body.health_status)) {
      return NextResponse.json({ error: `health_status must be one of: ${ACCOUNT_HEALTH_STATUSES.join(', ')}` }, { status: 400 })
    }

    const account = await updateCustomerAccount(organizationId, id, body)
    if (!account) return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    return NextResponse.json({
      id: account.id,
      health_status: account.health_status,
      health_score: account.health_score,
      renewal_date: account.renewal_date,
      last_activity_at: account.last_activity_at,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
