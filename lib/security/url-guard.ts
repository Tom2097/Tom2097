import "server-only"
import { promises as dns } from "dns"
import { isIP } from "net"

/**
 * SSRF prevention for any code path that fetches a client-supplied URL from
 * the server (e.g. lib/operational/intake.ts's ingestUrl, reachable via
 * POST /api/v1/operations/ingest-url). Rejects non-http(s) schemes, the
 * literal "localhost", and any hostname that resolves to a private/
 * internal/link-local/loopback address -- including cloud metadata
 * endpoints, which all live in 169.254.0.0/16.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal"])

// IPv4 ranges that must never be reachable from a server-side fetch of a
// client-supplied URL.
const PRIVATE_IPV4_RANGES: Array<{ base: number[]; bits: number }> = [
  { base: [10, 0, 0, 0], bits: 8 }, // RFC1918
  { base: [172, 16, 0, 0], bits: 12 }, // RFC1918
  { base: [192, 168, 0, 0], bits: 16 }, // RFC1918
  { base: [127, 0, 0, 0], bits: 8 }, // loopback
  { base: [169, 254, 0, 0], bits: 16 }, // link-local, incl. cloud metadata (169.254.169.254)
  { base: [0, 0, 0, 0], bits: 8 }, // "this" network
  { base: [100, 64, 0, 0], bits: 10 }, // carrier-grade NAT
  { base: [192, 0, 0, 0], bits: 24 }, // IETF protocol assignments
  { base: [198, 18, 0, 0], bits: 15 }, // benchmarking
]

function ipv4ToInt(parts: number[]): number {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map((p) => Number(p))
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true // malformed -> fail closed
  const addrInt = ipv4ToInt(parts)
  return PRIVATE_IPV4_RANGES.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (addrInt & mask) === (ipv4ToInt(base) & mask)
  })
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === "::1") return true // loopback
  if (normalized === "::") return true // unspecified
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) -- check the embedded IPv4 address.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  // Unique local addresses (fc00::/7) and link-local (fe80::/10).
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true
  return false
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIPv4(address)
  if (version === 6) return isPrivateIPv6(address)
  return true // not a recognizable IP -> fail closed
}

export class UnsafeUrlError extends Error {}

/**
 * Throws UnsafeUrlError if `rawUrl` is not safe for the server to fetch:
 * non-http(s) scheme, blocked hostname, or any resolved address landing in
 * a private/internal/link-local/loopback range. Call this immediately
 * before any server-side fetch of a client-supplied URL.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeUrlError("Invalid URL")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs are allowed")
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeUrlError("This hostname is not allowed")
  }

  // If the hostname is already a literal IP, check it directly -- no DNS
  // lookup will happen for it anyway.
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new UnsafeUrlError("This address is not allowed")
    return url
  }

  let addresses: string[]
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true })
    addresses = results.map((r) => r.address)
  } catch {
    throw new UnsafeUrlError("Could not resolve hostname")
  }

  if (addresses.length === 0 || addresses.some((addr) => isPrivateIp(addr))) {
    throw new UnsafeUrlError("This hostname resolves to a disallowed address")
  }

  return url
}
