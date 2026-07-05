import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { trackUsage } from '@/lib/billing/usage-tracking'

// API endpoints that should trigger usage tracking
export const USAGE_TRACKED_ENDPOINTS: Record<string, {
  usageType: string
  quantity?: number
}> = {
  // AI endpoints
  '/api/v1/ai/chat': { usageType: 'ai_chat' },
  '/api/v1/ai/generate': { usageType: 'ai_generation' },
  '/api/v1/ai/analyze': { usageType: 'ai_analysis' },
  '/api/v1/ai/provision': { usageType: 'ai_generation' },
  
  // Document processing endpoints
  '/api/v1/operations/extract': { usageType: 'document_processing' },
  '/api/v1/operations/classify': { usageType: 'document_processing' },
  '/api/v1/operations/ingest-upload': { usageType: 'data_ingestion' },
  '/api/v1/operations/ingest-email': { usageType: 'data_ingestion' },
  '/api/v1/operations/ingest-url': { usageType: 'data_ingestion' },
  '/api/v1/operations/ocr': { usageType: 'ocr_processing' },
  '/api/v1/operations/nlp': { usageType: 'nlp_analysis' },
  
  // Workflow endpoints
  '/api/v1/workflows/execute': { usageType: 'workflow_execution' },
  '/api/v1/workflows/run-scheduled': { usageType: 'workflow_execution' },
  
  // Search endpoints
  '/api/v1/search': { usageType: 'search_queries' },
  '/api/v1/search/autocomplete': { usageType: 'search_queries' },
  
  // CRM endpoints
  '/api/v1/crm/contacts': { usageType: 'crm_operations', quantity: 0.1 },
  '/api/v1/crm/companies': { usageType: 'crm_operations', quantity: 0.1 },
  '/api/v1/crm/deals': { usageType: 'crm_operations', quantity: 0.2 },
  '/api/v1/crm/activities': { usageType: 'crm_operations', quantity: 0.1 },
  '/api/v1/crm/support-tickets': { usageType: 'support_tickets', quantity: 0.5 },
}

export async function trackUsageMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Check if this endpoint should be tracked
  const endpointConfig = Object.entries(USAGE_TRACKED_ENDPOINTS).find(([endpoint]) =>
    pathname.startsWith(endpoint)
  )
  
  if (!endpointConfig) {
    return NextResponse.next()
  }
  
  const [endpoint, config] = endpointConfig
  const { usageType, quantity = 1 } = config
  
  try {
    // Extract organization ID from the request (assuming it's in the auth token)
    // In a real implementation, you would decode the JWT or session token
    const organizationId = request.headers.get('x-organization-id')
    const userId = request.headers.get('x-user-id')
    
    if (!organizationId) {
      console.warn('[UsageMiddleware] No organization ID found for usage tracking')
      return NextResponse.next()
    }
    
    // Track the usage
    await trackUsage(
      organizationId,
      userId,
      usageType as any,
      quantity
    )
    
    return NextResponse.next()
  } catch (error) {
    console.error('[UsageMiddleware] Error tracking usage:', error)
    return NextResponse.next()
  }
}