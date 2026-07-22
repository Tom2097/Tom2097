import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DELETE backs the "Delete" button (handleDeleteModel) in
 * components/digit/predictive-modeling.tsx, which previously called a route
 * that didn't exist. Deleting a model record is a genuinely real, simple
 * capability (no fabrication concern -- it's just an org-scoped row delete),
 * unlike prediction/training metrics which this environment can't back with
 * real ML infrastructure (see lib/ai/model-training.ts).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const modelId = params.id
    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ai_models')
      .delete()
      .eq('id', modelId)
      .eq('organization_id', organizationId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[Models] Error deleting model:', error)
      return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
