import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { listCustomerAccounts } from '@/lib/crm/extensions'
import { createServiceClient } from '@/lib/supabase/service'
import type { AccountHealthStatus } from '@/lib/crm/types'

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
