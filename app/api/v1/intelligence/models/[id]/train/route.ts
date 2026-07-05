import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { startModelTraining } from '@/lib/ai/model-training'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const modelId = params.id
    const { datasetId } = await request.json()

    if (!modelId || !datasetId) {
      return NextResponse.json(
        { error: 'Model ID and dataset ID are required' },
        { status: 400 }
      )
    }

    const result = await startModelTraining(organizationId, user.id, modelId, datasetId)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to start model training' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      jobId: modelId
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}