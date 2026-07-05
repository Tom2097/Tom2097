
import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/with-auth'
import { startModelTraining } from '@/lib/ai/model-training'

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
    const { datasetId } = await request.json()
    
    if (!modelId || !datasetId) {
      return NextResponse.json(
        { error: 'Model ID and dataset ID are required' },
        { status: 400 }
      )
    }
    
    const result = await startModelTraining(organizationId, context.userId, modelId)
    
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to start model training' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      jobId: modelId // Using modelId as jobId for now
    })
  } catch (error) {
    console.error('[ModelTrain] Error:', error)
    return NextResponse.json(
      { error: 'Failed to start model training' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handler as AuthHandler);