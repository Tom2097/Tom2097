import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { updateSessionWithUser } from '@/lib/supabase/middleware'
import { buildEntry, getSessionUserId, isPrefetch, shouldLogApi, writeActivity } from '@/lib/activity/log'

// digit-ai.in is a second domain pointed at the same app, permanently
// redirected to the canonical digit-ai.org (founder's call: one canonical
// URL, no duplicate-content SEO issues, no cross-domain auth-cookie
// complications). Checked before session handling runs at all -- a request
// that's about to be redirected away has no reason to pay for a Supabase
// session lookup first.
const REDIRECT_HOSTS = new Set(['digit-ai.in', 'www.digit-ai.in'])

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - files with extensions (e.g. .svg, .png)
     * API routes are matched only so signed-in API calls can be written to
     * the activity log; session handling below still skips them.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
}

const REGION_COOKIE = 'NEXT_REGION'

function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return []
  return header
    .split(',')
    .map((part) => {
      const [lang, q] = part.trim().split(';q=')
      return { lang: lang.trim().toLowerCase(), q: q ? parseFloat(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
    .map((item) => item.lang)
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase()
  if (host && REDIRECT_HOSTS.has(host)) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://digit-ai.org')
    return NextResponse.redirect(target, 308)
  }

  // API routes: no session handling here (each route authenticates itself).
  // Only record the call in the activity log, after the response is sent.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (shouldLogApi(request.nextUrl.pathname)) {
      event.waitUntil(
        getSessionUserId(request).then((userId) =>
          userId ? writeActivity(buildEntry(request, userId, 'api')) : undefined,
        ),
      )
    }
    return NextResponse.next()
  }

  // Auth/session handling runs first: it fail-closed redirects unauthenticated
  // requests away from protected pages (see lib/supabase/middleware.ts) and
  // refreshes the Supabase session cookie. Previously this function existed
  // but was never wired into middleware.ts, so protected routes were only
  // ever gated by client-side (bypassable) checks.
  const { response: sessionResponse, userId } = await updateSessionWithUser(request)

  // Activity log: signed-in page visits (prefetches are the router warming
  // its cache, not the user doing anything).
  if (userId && request.method === 'GET' && !isPrefetch(request)) {
    event.waitUntil(writeActivity(buildEntry(request, userId, 'page')))
  }

  // A redirect (e.g. to /auth/login, or away from /auth/* when already
  // signed in) takes priority -- don't layer locale/region cookies onto it.
  if (sessionResponse.headers.get('location')) {
    return sessionResponse
  }

  // Vercel's x-vercel-ip-country only exists on Vercel's edge network; self-hosted
  // behind Coolify there's no equivalent unless Cloudflare is put in front.
  const country = request.headers.get('cf-ipcountry') || null
  const acceptLanguage = request.headers.get('accept-language')
  const browserLanguages = parseAcceptLanguage(acceptLanguage)
  const existingRegion = request.cookies.get(REGION_COOKIE)?.value

  // Set/refresh region cookie directly on the response updateSession produced,
  // so any refreshed Supabase auth cookies it attached are preserved. Language
  // is never auto-switched silently; the client banner asks the user before
  // setting NEXT_LOCALE.
  if (country && existingRegion !== country) {
    sessionResponse.cookies.set(REGION_COOKIE, country, { maxAge: 60 * 60 * 24 * 365, path: '/' })
  }
  return sessionResponse
}
