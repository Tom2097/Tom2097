import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { listDefinitions, createDefinition, generateRun } from '@/lib/reporting/engine'

const DEFINITION_NAME = 'Performance Snapshot'

export const maxDuration = 30

export async function POST() {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { items } = await listDefinitions(ctx.organizationId, { activeOnly: true })
    let definition = items.find((d) => d.name === DEFINITION_NAME)

    if (!definition) {
      definition = await createDefinition(ctx.organizationId, ctx.userId, {
        name: DEFINITION_NAME,
        description: 'Analytics summary for the performance dashboard',
        sections: [{ key: 'summary', title: 'Analytics Summary', source: 'analytics', params: { type: 'summary' } }],
        range_days: 30,
      })
    }

    const run = await generateRun(ctx.organizationId, definition.id, ctx.userId, 'manual')
    if (!run) {
      return NextResponse.json({ error: 'Failed to run report' }, { status: 500 })
    }

    return NextResponse.json({ success: true, run })
  } catch (error) {
    console.error('[v1/performance/run-report] error:', error)
    return NextResponse.json({ error: 'Failed to run report' }, { status: 500 })
  }
}
