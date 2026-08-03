import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getConnector } from "@/lib/connectors/engine"
import { CONNECTOR_OAUTH, getProviderConfig, isProviderConfigured } from "@/lib/connectors/oauth-providers"
import { signOAuthState } from "@/lib/connectors/oauth"
import { getRequestOrigin } from "@/lib/http/request-origin"

// GET /api/v1/connectors/[id]/oauth/start
// Full-page redirect into the provider's consent screen -- this can't be an
// XHR/fetch like the rest of the connectors API, OAuth authorization
// endpoints only work via real browser navigation.
export const GET = withAuth(async (req, { params, organizationId }) => {
  const { id } = params
  const origin = getRequestOrigin(req)

  const connector = await getConnector(organizationId, id)
  if (!connector) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=connector_not_found", origin))
  }

  const oauth = CONNECTOR_OAUTH[connector.type]
  if (!oauth) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=not_oauth_connector", origin))
  }

  if (!isProviderConfigured(oauth.provider)) {
    return NextResponse.redirect(
      new URL(`/settings?tab=integrations&error=${oauth.provider}_not_configured`, origin),
    )
  }

  const redirectUri = `${origin}/api/v1/connectors/oauth/callback/${oauth.provider}`
  const state = signOAuthState({ connectorId: connector.id, organizationId, redirectUri })
  const cfg = getProviderConfig(oauth.provider)

  const authUrl = new URL(cfg.authorizeUrl)
  authUrl.searchParams.set("client_id", cfg.clientId!)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", oauth.scope)
  authUrl.searchParams.set("state", state)
  for (const [key, value] of Object.entries(cfg.extraAuthorizeParams ?? {})) {
    authUrl.searchParams.set(key, value)
  }

  return NextResponse.redirect(authUrl)
})
