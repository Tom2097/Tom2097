/**
 * Centralized platform capacity configuration (single source of truth).
 *
 * All platform-wide and per-tenant limits live here. NOTHING in the codebase
 * should hardcode these numbers — import from this module instead. Every value
 * is overridable via environment variables so limits can be raised as the
 * business grows WITHOUT a code change or redeploy of business logic.
 *
 * Designed for controlled early-stage growth: conservative defaults that keep
 * the platform stable while a small number of tenants are onboarded.
 */

export interface CapacityLimits {
  /** Hard cap on the number of companies (tenants / organizations). */
  maxTenants: number
  /** Soft target for concurrent users across the whole platform. */
  maxConcurrentUsers: number
  /** Default maximum users allowed within a single company. */
  maxUsersPerCompany: number
  /** Maximum AI message/requests per tenant per calendar month. */
  maxAiRequestsPerTenantMonthly: number
  /** Maximum workflow executions per tenant per calendar month. */
  maxWorkflowExecutionsPerTenantMonthly: number
  /** Maximum document storage per tenant, in megabytes. */
  maxDocumentStorageMbPerTenant: number
}

/** Parse an int env var, falling back to a default when unset/invalid. */
function envInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Resolve the active capacity limits. Reads env vars on each call so updated
 * project env values take effect without code changes.
 *
 * Current growth-stage defaults:
 *   - 20 companies
 *   - 1000 concurrent users platform-wide
 */
export function getCapacityLimits(): CapacityLimits {
  return {
    maxTenants: envInt("PLATFORM_MAX_TENANTS", 20),
    maxConcurrentUsers: envInt("PLATFORM_MAX_CONCURRENT_USERS", 1000),
    maxUsersPerCompany: envInt("PLATFORM_MAX_USERS_PER_COMPANY", 50),
    maxAiRequestsPerTenantMonthly: envInt("PLATFORM_MAX_AI_REQUESTS_PER_TENANT_MONTHLY", 10000),
    maxWorkflowExecutionsPerTenantMonthly: envInt("PLATFORM_MAX_WORKFLOW_EXECUTIONS_PER_TENANT_MONTHLY", 5000),
    maxDocumentStorageMbPerTenant: envInt("PLATFORM_MAX_DOCUMENT_STORAGE_MB_PER_TENANT", 5120),
  }
}

/**
 * Window (in minutes) used to approximate "concurrent" users from recent
 * activity. A user counts as concurrent if they produced an analytics event
 * within this window.
 */
export const CONCURRENCY_WINDOW_MINUTES = envInt("PLATFORM_CONCURRENCY_WINDOW_MINUTES", 5)

/* -------------------------------------------------------------------------- */
/* User-friendly limit messages                                               */
/* -------------------------------------------------------------------------- */

export const CAPACITY_MESSAGES = {
  tenantsFull:
    "DigiT is currently at full capacity and not accepting new companies. We're onboarding in controlled waves — please check back soon or contact our team to join the waitlist.",
  usersPerCompanyFull: (max: number) =>
    `Your workspace has reached its limit of ${max} users. To add more team members, please contact your administrator about increasing your plan's seat count.`,
  concurrentUsersFull:
    "The platform is experiencing peak demand right now. Please try again in a few minutes.",
  aiQuotaFull:
    "Your organization has reached its monthly AI usage limit. Usage resets at the start of next month, or contact us to increase your quota.",
  workflowQuotaFull:
    "Your organization has reached its monthly workflow execution limit. Usage resets at the start of next month, or contact us to increase your quota.",
  storageFull:
    "Your organization has reached its document storage limit. Please remove unused files or contact us to increase your storage allowance.",
} as const
