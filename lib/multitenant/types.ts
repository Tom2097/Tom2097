export interface TenantContextMiddleware {
  tenantId: string
  organizationId: string
  userId: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
  teamId?: string | null
  planId?: string
  featureFlags?: string[]
  trialEndsAt?: string | null
  billingPeriodEndsAt?: string | null
}
