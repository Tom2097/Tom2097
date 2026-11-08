import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  return (await updateSessionWithUser(request)).response
}

/** Same as updateSession, also returning the verified signed-in user's id (or null). */
export async function updateSessionWithUser(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null }> {
  return refreshSession(request)
}

async function refreshSession(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null }> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Every signed-in-only page. This used to list just the first 7 modules,
  // so the rest of the (dashboard) group -- /intelligence, /approvals,
  // /feedback, /bulk, /dsar, ... -- rendered app chrome (and, for
  // /intelligence, placeholder metrics) to signed-out visitors instead of
  // sending them to log in. Matched per path segment so e.g. "/billing"
  // can't swallow an unrelated "/billing-faq".
  const protectedPaths = [
    '/analytics', '/approvals', '/benchmarks', '/billing', '/bulk', '/compliance',
    '/configure', '/crm', '/design-partner', '/driver-analysis', '/dsar', '/esign',
    '/feedback', '/healthcare', '/intelligence', '/materialized-views', '/onboarding',
    '/operations', '/performance', '/platform', '/predictive-maintenance', '/recordings',
    '/resources', '/settings', '/simulate', '/skill-matrix', '/training',
  ]
  const pathname = request.nextUrl.pathname
  const isProtectedPath = protectedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))

  // Fail closed: if auth is not configured we cannot verify any session, so
  // protected pages and the authenticated API surface must be blocked rather
  // than served anonymously.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return { userId: null, response: NextResponse.json(
        { error: "Service Unavailable", message: "Authentication is not configured" },
        { status: 503 },
      ) }
    }
    if (isProtectedPath) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return { userId: null, response: NextResponse.redirect(url) }
    }
    return { userId: null, response: supabaseResponse }
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes - redirect to login if not authenticated
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return { userId: null, response: NextResponse.redirect(url) }
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ['/auth/login', '/auth/sign-up']
  const isAuthPath = authPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return { userId: user?.id ?? null, response: NextResponse.redirect(url) }
  }

  return { userId: user?.id ?? null, response: supabaseResponse }
}
