import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { verifyOAuthState, exchangeCodeForTokens } from "@/lib/connectors/oauth"
import type { OAuthProvider } from "@/lib/connectors/oauth-providers"
import { getRequestOrigin } from "@/lib/http/request-origin"

const VALID_PROVIDERS: OAuthProvider[] = ["google", "microsoft", "slack"]

// GET /api/v1/connectors/oauth/callback/[provider]
// Google/Microsoft/Slack redirect the browser here after consent -- this is
// a top-level navigation from the provider's own domain, so it can't carry
// custom headers. The signed `state` param (minted in oauth/start, tied to
// one connector + org, 10-minute expiry) is what's actually trusted here,
// not just the caller's session cookie.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const origin = getRequestOrigin(request)
  const { provider } = await params

  if (!VALID_PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=unknown_provider", origin))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=oauth_denied", origin))
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=missing_code", origin))
  }

  const payload = verifyOAuthState(state)
  if (!payload) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=invalid_state", origin))
  }

  try {
    const tokens = await exchangeCodeForTokens(provider as OAuthProvider, code, payload.redirectUri)

    const db = createServiceClient()
    const { data: connector } = await db
      .from("connectors")
      .select("credentials")
      .eq("id", payload.connectorId)
      .eq("organization_id", payload.organizationId)
      .maybeSingle()

    if (!connector) {
      return NextResponse.redirect(new URL("/settings?tab=integrations&error=connector_not_found", origin))
    }

    const credentials = { ...connector.credentials, ...tokens }
    const { error } = await db
      .from("connectors")
      .update({ credentials, enabled: true })
      .eq("id", payload.connectorId)
      .eq("organization_id", payload.organizationId)

    if (error) throw error

    return NextResponse.redirect(new URL("/settings?tab=integrations&connected=1", origin))
  } catch (err) {
    console.error("[connectors/oauth/callback] failed:", err)
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=oauth_failed", origin))
  }
}
