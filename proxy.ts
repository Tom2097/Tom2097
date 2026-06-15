import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  // Refresh the Supabase Auth session cookie and enforce route protection.
  // Per-request identity/tenant resolution happens inside the route handlers
  // via withAuth → extractTenantContext (which reads the verified session),
  // so the middleware does not need to resolve tenant context itself.
  return await updateSession(request)
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
