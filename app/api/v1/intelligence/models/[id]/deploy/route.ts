import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { deployModel } from '@/lib/ai/model-training'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const modelId = params.id
    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      )
    }

    const result = await deployModel(organizationId, user.id, modelId)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to deploy model' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      endpoint: result.endpoint
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}