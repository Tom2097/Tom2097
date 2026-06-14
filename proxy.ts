import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { extractTenantContext } from "@/lib/multitenant/context"

export async function proxy(request: NextRequest) {
  // First, update session for auth
  const sessionResponse = await updateSession(request)

  // Then, extract tenant context for API routes (if X-Tenant-ID header is present)
  // This is optional - tenant context is only required for /api/v1/tenants/* routes
  const tenantId = request.headers.get("x-tenant-id")
  if (tenantId && request.nextUrl.pathname.startsWith("/api/v1/tenants/")) {
    const tenantContext = await extractTenantContext(request)
    
    if (!tenantContext) {
      console.warn(`[v0] Invalid tenant context for request to ${request.nextUrl.pathname}`)
      // Continue - the route handler will also validate tenant context
    }
  }

  return sessionResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - .well-known/workflow (Workflow SDK internal paths)
     */
    "/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
