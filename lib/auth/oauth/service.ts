import { createHash, randomBytes } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { SUPPORTED_PROVIDERS, OAuthErrorCode } from "./types"
import type { OAuthProviderConfig, OAuthUserProfile, OAuthTokenSet } from "./types"

function getProvider(providerId: string): OAuthProviderConfig {
  const config = SUPPORTED_PROVIDERS[providerId]
  if (!config) throw new Error(`Unsupported OAuth provider: ${providerId}`)
  if (!config.enabled) throw new Error(`OAuth provider disabled: ${providerId}`)
  return config
}

export function generateAuthorizationUrl(providerId: string, redirectTo: string): { url: string; state: string } {
  const config = getProvider(providerId)
  const state = randomBytes(32).toString("hex")
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state: JSON.stringify({ state, redirectTo }),
  })
  return { url: `${config.authorizationUrl}?${params.toString()}`, state }
}

export async function exchangeCodeForToken(providerId: string, code: string): Promise<OAuthTokenSet> {
  const config = getProvider(providerId)
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  })

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${OAuthErrorCode.TOKEN_EXCHANGE_FAILED}: ${res.status} ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    scope: data.scope,
  }
}

export async function fetchUserProfile(providerId: string, token: OAuthTokenSet): Promise<OAuthUserProfile> {
  const config = getProvider(providerId)
  if (!config.userInfoUrl) throw new Error("No userInfoUrl for provider")

  const res = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })

  if (!res.ok) throw new Error(`${OAuthErrorCode.USER_INFO_FAILED}: ${res.status}`)
  const data = await res.json()

  const profile: OAuthUserProfile = {
    id: data.id || data.sub || data.email,
    email: data.email || "",
    name: data.name || data.login || "",
    firstName: data.given_name || data.firstName || "",
    lastName: data.family_name || data.lastName || "",
    picture: data.picture || data.avatar_url || "",
    provider: providerId,
    providerId: String(data.id || data.sub || ""),
    rawProfile: data,
  }
  return profile
}

export async function findOrCreateUser(profile: OAuthUserProfile): Promise<string> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from("oauth_accounts")
    .select("user_id")
    .eq("provider", profile.provider)
    .eq("provider_id", profile.providerId)
    .maybeSingle()

  if (existing) return existing.user_id as string

  const { data: userByEmail } = await db
    .from("profiles")
    .select("id")
    .eq("email", profile.email)
    .maybeSingle()

  let userId: string
  if (userByEmail) {
    userId = userByEmail.id as string
  } else {
    const { data: newUser, error: signUpErr } = await db.auth.admin.createUser({
      email: profile.email,
      email_confirm: true,
      user_metadata: { name: profile.name, picture: profile.picture },
    })
    if (signUpErr || !newUser?.user) throw new Error("Failed to create user")
    userId = newUser.user.id

    await db.from("profiles").insert({
      id: userId,
      email: profile.email,
      full_name: profile.name,
      avatar_url: profile.picture,
    })
  }

  await db.from("oauth_accounts").insert({
    user_id: userId,
    provider: profile.provider,
    provider_id: profile.providerId,
    access_token: "",
    refresh_token: "",
  })

  return userId
}
