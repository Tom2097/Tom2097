/**
 * Next.js's standalone server (self-hosted, output: 'standalone') derives
 * request.url's origin from its own bind address (HOSTNAME/PORT) rather than
 * the real Host header, so it resolves to e.g. http://0.0.0.0:3000 behind a
 * reverse proxy. Use the proxy's X-Forwarded-* headers instead, falling back
 * to the request's own origin for local dev where there's no proxy in front.
 */
export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")
  if (!forwardedHost) return new URL(request.url).origin

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  return `${forwardedProto}://${forwardedHost}`
}
