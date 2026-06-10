import { type NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET || 'your-secret-key')

export interface TenantContextMiddleware {
  tenantId: string
  organizationId: string
  userId: string
  email: string
  role: 'admin' | 'member' | 'viewer'
}

/**
 * Extract and validate tenant context from request headers
 * Must be called before any API route handler
 */
export async function extractTenantContext(
  request: NextRequest
): Promise<TenantContextMiddleware | null> {
  try {
    // Get tenant ID from custom header
    const tenantId = request.headers.get('x-tenant-id')
    if (!tenantId) {
      console.warn('[v0] Missing X-Tenant-ID header')
      return null
    }

    // Get JWT token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('[v0] Missing or invalid Authorization header')
      return null
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    let payload: any
    try {
      const verified = await jwtVerify(token, JWT_SECRET)
      payload = verified.payload
    } catch (err) {
      console.error('[v0] JWT verification failed:', err)
      return null
    }

    // Validate tenant_id claim matches header
    if (payload.tenant_id !== tenantId) {
      console.error('[v0] Tenant ID mismatch between header and JWT')
      return null
    }

    return {
      tenantId,
      organizationId: payload.org_id || payload.sub,
      userId: payload.sub,
      email: payload.email,
      role: payload.role || 'member',
    }
  } catch (error) {
    console.error('[v0] Error extracting tenant context:', error)
    return null
  }
}

/**
 * Higher-order middleware to wrap API routes with tenant validation
 * Usage: export const withTenantContext = createTenantMiddleware(handler)
 */
export function withTenantContext(
  handler: (
    req: NextRequest,
    context: TenantContextMiddleware
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx?: any) => {
    // Extract tenant context
    const tenantContext = await extractTenantContext(req)

    if (!tenantContext) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or missing tenant context',
        },
        { status: 401 }
      )
    }

    // Add tenant context to request for downstream access
    ;(req as any).tenantContext = tenantContext

    try {
      return await handler(req, tenantContext)
    } catch (error) {
      console.error('[v0] Error in tenant-protected route:', error)
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'An error occurred processing your request',
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Inject tenant context into NextRequest for downstream use
 * Stores in request locals which are passed to route handlers
 */
export function injectTenantContext(
  request: NextRequest,
  tenantContext: TenantContextMiddleware
): NextRequest {
  const requestWithContext = request.clone()
  ;(requestWithContext as any).tenantContext = tenantContext
  return requestWithContext
}

/**
 * Get tenant context from request in API routes
 * Must be called after withTenantContext middleware
 */
export function getTenantContextFromRequest(request: NextRequest): TenantContextMiddleware | null {
  return (request as any).tenantContext || null
}
