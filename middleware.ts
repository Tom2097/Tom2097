import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function middleware(request: NextRequest) {
  // Vercel's x-vercel-ip-country only exists on Vercel's edge network; self-hosted
  // behind Coolify there's no equivalent unless Cloudflare is put in front.
  const country = request.headers.get('cf-ipcountry') || null
  const acceptLanguage = request.headers.get('accept-language')
  const browserLanguages = parseAcceptLanguage(acceptLanguage)
  const existingRegion = request.cookies.get(REGION_COOKIE)?.value

  // Add detection headers for downstream use (pricing, data residency, etc.)
  const requestHeaders = new Headers(request.headers)
  if (country) requestHeaders.set('x-detected-country', country)
  if (browserLanguages[0]) requestHeaders.set('x-detected-language', browserLanguages[0])

  // Set/refresh region cookie. Language is never auto-switched silently;
  // the client banner asks the user before setting NEXT_LOCALE.
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (country && existingRegion !== country) {
    response.cookies.set(REGION_COOKIE, country, { maxAge: 60 * 60 * 24 * 365, path: '/' })
  }
  return response
}
