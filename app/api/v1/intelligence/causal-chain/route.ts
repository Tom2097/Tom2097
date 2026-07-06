import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getCrossModuleChains, traceCausalChain } from '@/lib/intelligence/causal-chain'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(req.url)
    const entityId = searchParams.get('entityId')
    const crossModule = searchParams.get('crossModule') === 'true'

    if (entityId) {
      const chain = await traceCausalChain(organizationId, entityId)
      return NextResponse.json(chain)
    }

    if (crossModule) {
      const chains = await getCrossModuleChains(organizationId)
      return NextResponse.json({ chains })
    }

    return NextResponse.json({ chains: [] })
  } catch (error) {
    console.error('[CausalChain] Error fetching causal chains:', error)
    return handleAuthError(error as Error)
  }
}
