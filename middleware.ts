import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - api routes
     * - files with extensions (e.g. .svg, .png)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|.*\\..*).*)',
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

export async function middleware(request: NextRequest) {
  // Auth/session handling runs first: it fail-closed redirects unauthenticated
  // requests away from protected pages (see lib/supabase/middleware.ts) and
  // refreshes the Supabase session cookie. Previously this function existed
  // but was never wired into middleware.ts, so protected routes were only
  // ever gated by client-side (bypassable) checks.
  const sessionResponse = await updateSession(request)

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
