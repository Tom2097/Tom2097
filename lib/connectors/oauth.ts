import crypto from "crypto"
import { getProviderConfig, type OAuthProvider } from "./oauth-providers"

interface OAuthStatePayload {
  connectorId: string
  organizationId: string
  redirectUri: string
  exp: number
}

// Signs the OAuth `state` param so the callback can trust which connector/org
// it belongs to without a second DB round-trip, and so it can't be replayed
// against a different connector. Reuses the service-role key as HMAC secret
// rather than introducing a dedicated env var for a value that's already
// secret, server-only, and not casually rotated.
function stateSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  return secret
}

export function signOAuthState(payload: Omit<OAuthStatePayload, "exp">): string {
  const full: OAuthStatePayload = { ...payload, exp: Date.now() + 10 * 60 * 1000 }
  const json = Buffer.from(JSON.stringify(full)).toString("base64url")
  const sig = crypto.createHmac("sha256", stateSecret()).update(json).digest("base64url")
  return `${json}.${sig}`
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [json, sig] = state.split(".")
  if (!json || !sig) return null
  const expected = crypto.createHmac("sha256", stateSecret()).update(json).digest("base64url")
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString()) as OAuthStatePayload
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export interface TokenSet {
  access_token: string
  refresh_token?: string
  expires_at?: number
  bot_token?: string
}

export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<TokenSet> {
  const cfg = getProviderConfig(provider)
  if (!cfg.clientId || !cfg.clientSecret) throw new Error(`${provider} OAuth is not configured`)

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  })

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = await res.json()

  if (provider === "slack") {
    if (!res.ok || data.ok === false) throw new Error(data.error || "slack token exchange failed")
    // Slack's bot-scope response carries the bot token as the top-level
    // access_token (there is no refresh_token -- classic bot tokens don't expire).
    return { access_token: data.access_token, bot_token: data.access_token }
  }

  if (!res.ok || data.error) throw new Error(data.error_description || data.error || `${provider} token exchange failed`)

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : undefined,
  }
}

export async function refreshAccessToken(provider: OAuthProvider, refreshToken: string): Promise<TokenSet> {
  const cfg = getProviderConfig(provider)
  if (!cfg.clientId || !cfg.clientSecret) throw new Error(`${provider} OAuth is not configured`)

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error_description || data.error || `${provider} token refresh failed`)

  return {
    access_token: data.access_token,
    // Google/Microsoft don't always return a new refresh_token on refresh --
    // when they don't, the old one keeps working, so callers must fall back to it.
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : undefined,
  }
}
