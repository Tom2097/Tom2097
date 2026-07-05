
import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/with-auth'
import { makePrediction } from '@/lib/ai/model-training'

type AuthHandler = Parameters<typeof withAuth>[0]

async function handler(
  request: NextRequest,
  context: AuthContext & { params: { id: string } }
) {
  const { params, organizationId } = context;
  
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  
  try {
    const modelId = params.id
    const { input } = await request.json()
    
    if (!modelId || !input) {
      return NextResponse.json(
        { error: 'Model ID and input are required' },
        { status: 400 }
      )
    }
    
    const result = await makePrediction(organizationId, context.userId, modelId, input)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to make prediction' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      prediction: result.prediction
    })
  } catch (error) {
    console.error('[ModelPredict] Error:', error)
    return NextResponse.json(
      { error: 'Failed to make prediction' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handler as AuthHandler);