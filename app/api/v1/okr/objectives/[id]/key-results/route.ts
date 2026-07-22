import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { getObjective, listKeyResults, createKeyResult, updateKeyResultValue } from '@/lib/analytics/okr'

// GET /api/v1/okr/objectives/[id]/key-results -- list key results for an objective.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const objective = await getObjective(ctx.organizationId, id)
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 })
  }

  const keyResults = await listKeyResults(id)
  return NextResponse.json({ keyResults })
}

// POST /api/v1/okr/objectives/[id]/key-results -- add a key result to an objective.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const objective = await getObjective(ctx.organizationId, id)
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    metric?: string
    target?: number
    current?: number
    unit?: string
    weight?: number
  }
  if (!body.name || typeof body.target !== 'number' || !Number.isFinite(body.target)) {
    return NextResponse.json({ error: 'name and target are required' }, { status: 400 })
  }

  const keyResult = await createKeyResult(id, {
    name: body.name,
    metric: body.metric,
    target: body.target,
    current: body.current,
    unit: body.unit,
    weight: body.weight,
  })
  if (!keyResult) {
    return NextResponse.json({ error: 'Failed to create key result' }, { status: 500 })
  }

  return NextResponse.json({ success: true, keyResult })
}

// PATCH /api/v1/okr/objectives/[id]/key-results -- update a key result's current value,
// which recomputes the parent objective's weighted progress/status (see updateKeyResultValue).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const objective = await getObjective(ctx.organizationId, id)
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as { keyResultId?: string; currentValue?: number }
  if (!body.keyResultId || typeof body.currentValue !== 'number' || !Number.isFinite(body.currentValue)) {
    return NextResponse.json({ error: 'keyResultId and currentValue are required' }, { status: 400 })
  }

  // updateKeyResultValue only scopes by key-result id, so confirm the key result
  // actually belongs to this (org-verified) objective before applying the update.
  const keyResults = await listKeyResults(id)
  if (!keyResults.some((kr) => kr.id === body.keyResultId)) {
    return NextResponse.json({ error: 'Key result not found on this objective' }, { status: 404 })
  }

  const updated = await updateKeyResultValue(body.keyResultId, body.currentValue)
  if (!updated) {
    return NextResponse.json({ error: 'Failed to update key result' }, { status: 500 })
  }

  return NextResponse.json({ success: true, keyResult: updated })
}
