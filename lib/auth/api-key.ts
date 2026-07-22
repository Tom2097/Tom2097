import { createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * API key authentication.
 *
 * Verifies an "Authorization: Bearer <key>" header against the api_keys
 * table (see supabase/migrations/20260817000000_api_keys.sql and the
 * generate/list/revoke handlers in app/api/v1/api-keys/route.ts). The raw
 * key handed to the caller at generation time looks like
 * "dk_<uuid-no-dashes><org-id-prefix>"; it is never persisted. What IS
 * persisted is:
 *   - key_prefix: the first 12 characters of that raw key, kept only so the
 *     Settings UI can show the user which key is which.
 *   - key_hash: sha256(rawKey), hex-encoded.
 * Authenticating a presented key means re-hashing it with the exact same
 * sha256 scheme and looking up the row by key_hash.
 *
 * A key row's mere existence means it hasn't been revoked -- revoking a key
 * (DELETE /api/v1/api-keys) deletes the row outright, there is no
 * revoked_at/is_active flag to additionally check.
 */

export interface ApiKeyAuth {
  apiKeyId: string
  organizationId: string
  createdBy: string | null
  scopes: string[]
  keyPrefix: string
}

const RAW_KEY_PREFIX = "dk_"

/** Pull the raw key out of the request's Authorization header, if present. */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (!authHeader) return null

  const [scheme, ...rest] = authHeader.trim().split(/\s+/)
  if (scheme?.toLowerCase() !== "bearer") return null

  const token = rest.join(" ").trim()
  if (!token.startsWith(RAW_KEY_PREFIX)) return null

  return token
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

/**
 * Resolve an "Authorization: Bearer <key>" header into the organization +
 * scopes it grants, or null if the header is absent, malformed, or doesn't
 * match a live key. Never throws -- callers should treat null as "no API
 * key presented, fall back to session auth."
 */
export async function resolveApiKeyAuth(request: Request): Promise<ApiKeyAuth | null> {
  const rawKey = extractApiKey(request)
  if (!rawKey) return null

  const supabase = createServiceClient()
  const { data: row, error } = await supabase
    .from("api_keys")
    .select("id, organization_id, key_prefix, scopes, created_by")
    .eq("key_hash", hashKey(rawKey))
    .maybeSingle()

  if (error || !row) return null

  const result: ApiKeyAuth = {
    apiKeyId: row.id as string,
    organizationId: row.organization_id as string,
    createdBy: (row.created_by as string | null) ?? null,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    keyPrefix: row.key_prefix as string,
  }

  // Record usage without making the caller wait on it.
  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", result.apiKeyId)
    .then(undefined, () => {
      // Best-effort; a failed last_used_at bump must never fail the request.
    })

  return result
}

const READ_ACTIONS = new Set(["read", "view", "list"])
const WRITE_ACTIONS = new Set(["write", "create", "update", "delete", "manage"])

/**
 * Does an API key with the given scopes satisfy a withAuth permission key
 * (e.g. "documents:read", "reports:write", "kb:manage")?
 *
 * Scopes are coarse ("read" / "write") while permission keys are
 * per-resource ("<resource>:<action>"), so this matches on the verb after
 * the last ":" instead of requiring an exact catalog lookup. "write" implies
 * "read" -- a key that can mutate a resource can obviously view it too.
 */
export function apiKeyPermits(permissionKey: string, scopes: string[]): boolean {
  const action = permissionKey.includes(":") ? permissionKey.slice(permissionKey.lastIndexOf(":") + 1) : permissionKey

  const hasWrite = scopes.includes("write")
  const hasRead = scopes.includes("read") || hasWrite

  if (hasWrite && WRITE_ACTIONS.has(action)) return true
  if (hasRead && READ_ACTIONS.has(action)) return true
  return false
}
