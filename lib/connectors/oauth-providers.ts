import type { ConnectorType } from "./types"

export type OAuthProvider = "google" | "microsoft" | "slack"

export interface OAuthProviderConfig {
  authorizeUrl: string
  tokenUrl: string
  clientId: string | undefined
  clientSecret: string | undefined
  /** Extra query params merged into the authorize URL (e.g. Google's offline-access flags). */
  extraAuthorizeParams?: Record<string, string>
}

/** Which OAuth provider (and scope) a connector type needs. */
export const CONNECTOR_OAUTH: Partial<Record<ConnectorType, { provider: OAuthProvider; scope: string }>> = {
  gmail: { provider: "google", scope: "https://www.googleapis.com/auth/gmail.readonly" },
  google_drive: { provider: "google", scope: "https://www.googleapis.com/auth/drive.readonly" },
  sharepoint: { provider: "microsoft", scope: "offline_access Sites.Read.All Files.Read.All" },
  slack: { provider: "slack", scope: "channels:history,channels:read,groups:history,groups:read" },
}

export function getProviderConfig(provider: OAuthProvider): OAuthProviderConfig {
  switch (provider) {
    case "google":
      return {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        // access_type=offline + prompt=consent are required to get a refresh_token
        // back on every connect, not just the very first time a user consents.
        extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
      }
    case "microsoft":
      return {
        authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
      }
    case "slack":
      return {
        authorizeUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        clientId: process.env.SLACK_CLIENT_ID,
        clientSecret: process.env.SLACK_CLIENT_SECRET,
      }
  }
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  const cfg = getProviderConfig(provider)
  return Boolean(cfg.clientId && cfg.clientSecret)
}
