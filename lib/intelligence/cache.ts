const cache = new Map<string, { data: unknown; expiresAt: number }>()

const TTL = {
  FINDINGS: 30_000,
  BRIEFING: 60_000,
  HEALTH: 15_000,
  CHAINS: 60_000,
}

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T, ttl: number): void {
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) cache.delete(key)
  }
}

export { TTL }
