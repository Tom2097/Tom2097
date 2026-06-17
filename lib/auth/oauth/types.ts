/**
 * OAuth Provider Types
 */

export interface OAuthProviderConfig {
  id: string
  name: string
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  enabled: boolean
}

export interface OAuthUserProfile {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  picture?: string
  provider: string
  providerId: string
  rawProfile?: Record<string, unknown>
}

export interface OAuthTokenSet {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  tokenType: string
  scope?: string
}

export interface OAuthSession {
  userId: string
  provider: string
  providerId: string
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  scopes: string[]
}

export interface OAuthState {
  state: string
  redirectTo: string
  provider: string
  nonce: string
  createdAt: Date
}

export interface OAuthError extends Error {
  code: OAuthErrorCode
  provider?: string
  details?: Record<string, unknown>
}

export enum OAuthErrorCode {
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  USER_INFO_FAILED = 'USER_INFO_FAILED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  PROVIDER_DISABLED = 'PROVIDER_DISABLED',
  STATE_MISMATCH = 'STATE_MISMATCH',
  CODE_EXPIRED = 'CODE_EXPIRED',
}

// Predefined OAuth provider configurations
export const GOOGLE_OAUTH_CONFIG: OAuthProviderConfig = {
  id: 'google',
  name: 'Google',
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/auth/oauth/callback/google`,
  scopes: [
    'openid',
    'email',
    'profile',
  ],
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  enabled: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
}

export const GITHUB_OAUTH_CONFIG: OAuthProviderConfig = {
  id: 'github',
  name: 'GitHub',
  clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/auth/oauth/callback/github`,
  scopes: [
    'user:email',
    'read:user',
  ],
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  enabled: !!process.env.GITHUB_OAUTH_CLIENT_ID,
}

export const MICROSOFT_OAUTH_CONFIG: OAuthProviderConfig = {
  id: 'microsoft',
  name: 'Microsoft',
  clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/auth/oauth/callback/microsoft`,
  scopes: [
    'openid',
    'email',
    'profile',
    'User.Read',
  ],
  authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  enabled: !!process.env.MICROSOFT_OAUTH_CLIENT_ID,
}

export const AZURE_AD_OAUTH_CONFIG: OAuthProviderConfig = {
  id: 'azure-ad',
  name: 'Azure Active Directory',
  clientId: process.env.AZURE_AD_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.AZURE_AD_OAUTH_CLIENT_SECRET || '',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/auth/oauth/callback/azure-ad`,
  scopes: [
    'openid',
    'email',
    'profile',
    'User.Read',
  ],
  authorizationUrl: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
  tokenUrl: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/token`,
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  enabled: !!process.env.AZURE_AD_OAUTH_CLIENT_ID,
}

export const OKTA_OAUTH_CONFIG: OAuthProviderConfig = {
  id: 'okta',
  name: 'Okta',
  clientId: process.env.OKTA_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.OKTA_OAUTH_CLIENT_SECRET || '',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/auth/oauth/callback/okta`,
  scopes: [
    'openid',
    'email',
    'profile',
  ],
  authorizationUrl: `${process.env.OKTA_OAUTH_ISSUER || 'https://{yourOktaDomain}'}/v1/authorize`,
  tokenUrl: `${process.env.OKTA_OAUTH_ISSUER || 'https://{yourOktaDomain}'}/v1/token`,
  userInfoUrl: `${process.env.OKTA_OAUTH_ISSUER || 'https://{yourOktaDomain}'}/v1/userinfo`,
  enabled: !!process.env.OKTA_OAUTH_CLIENT_ID,
}

export const SUPPORTED_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: GOOGLE_OAUTH_CONFIG,
  github: GITHUB_OAUTH_CONFIG,
  microsoft: MICROSOFT_OAUTH_CONFIG,
  'azure-ad': AZURE_AD_OAUTH_CONFIG,
  okta: OKTA_OAUTH_CONFIG,
}
