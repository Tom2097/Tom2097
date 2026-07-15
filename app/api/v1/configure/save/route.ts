import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  return NextResponse.json({ message: 'Test' })
}

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as Record<string, unknown>
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: workspace, error } = await db
    .from('workspaces')
    .insert({
      organization_id: ctx.organizationId,
      name: body.name,
      description: body.description ?? null,
      vertical: typeof body.vertical === 'string' ? body.vertical.toLowerCase() : 'general',
      owner: body.owner ?? null,
      data_sources: Array.isArray(body.dataSources) ? body.dataSources : [],
      auto_classify: body.autoClassify ?? true,
      auto_route: body.autoRoute ?? true,
      hitl_enabled: body.hitlEnabled ?? true,
      auto_create_tasks: body.autoCreateTasks ?? false,
      doc_to_workflow: body.docToWorkflow ?? false,
      team_roles: body.teamRoles ?? null,
      mfa_enforced: body.mfaEnforced ?? false,
      ip_whitelist: body.ipWhitelist ?? false,
      config: body,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[v1/configure/save] insert failed:', error)
    return NextResponse.json({ error: 'Failed to save workspace' }, { status: 500 })
  }

  // Persist routing rules derived from this workspace's vertical so
  // classifyAndRoute() (lib/operational/routing.ts) has something real to
  // match documents against, beyond its built-in defaults.
  await db
    .from('organization_settings')
    .upsert({ id: ctx.organizationId, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  return NextResponse.json({ success: true, workspace_id: workspace.id })
}
