import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { syncConnector } from '@/lib/connectors/engine'

// POST /api/v1/connectors/[id]/sync
// syncConnector() (lib/connectors/engine.ts) has always had real Gmail/Drive/
// Slack/SharePoint sync logic, but nothing ever called it -- this route was
// a stub that returned a canned "Test" message regardless of method or auth.
export const POST = withAuth(async (_req, { params, organizationId }) => {
  const { id } = params
  try {
    const result = await syncConnector(organizationId, id)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 500 })
  }
})
