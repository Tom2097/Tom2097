import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { makePrediction } from '@/lib/ai/model-training'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const modelId = params.id
    const { input } = await request.json()

    if (!modelId || !input) {
      return NextResponse.json(
        { error: 'Model ID and input are required' },
        { status: 400 }
      )
    }

    const result = await makePrediction(organizationId, user.id, modelId, input)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to make prediction' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      prediction: result.prediction
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}