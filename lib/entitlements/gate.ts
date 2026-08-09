import { getPlanById } from "@/lib/products"

export type FeatureId =
  | "ai_intelligence"
  | "advanced_analytics"
  | "document_processing"
  | "custom_roles"
  | "usage_billing"
  | "support_tickets"
  | "compliance_checks"
  | "crm"
  | "operations"
  | "performance"
  | "resources"
  | "compliance"
  | "workflow_automation"
  | "semantic_search"
  | "api_access"
  | "whatsapp_capture"
  | "autonomous_agents"
  | "simulation"
  | "white_label"
  | "sso_saml"
  | "audit_export"
  | "data_residency"
  | "on_premise"

export interface EntitlementResult {
  entitled: boolean
  limit?: number
  current?: number
  reason?: string
}

const ALL_FEATURES: FeatureId[] = [
  "crm", "operations", "performance", "resources", "compliance",
  "ai_intelligence", "advanced_analytics", "document_processing",
  "custom_roles", "usage_billing", "support_tickets", "compliance_checks",
  "workflow_automation", "semantic_search", "api_access", "whatsapp_capture",
  "autonomous_agents", "simulation", "white_label", "sso_saml",
  "audit_export", "data_residency", "on_premise",
]

/**
 * Single all-inclusive product (Pricing & Payments Build Spec v1.0) --
 * every feature is entitled to any real plan id. The old tiered
 * starter/professional/enterprise feature split is gone along with the
 * tiers themselves.
 */
export function getEntitlements(tierId: string): FeatureId[] {
  const plan = getPlanById(tierId)
  if (!plan) return []
  return ALL_FEATURES
}

export function isEntitled(tierId: string | undefined | null, feature: FeatureId): boolean {
  if (!tierId) return false
  return getEntitlements(tierId).includes(feature)
}

/**
 * "trialing" counts as entitled, not just "active" -- the spec's core
 * mechanic is that a confirmed trial gets FULL product access (spec
 * section 1, step 4), not a locked-down preview. This was a real gap
 * before: this function previously only allowed "active", meaning a
 * trialing org authenticated fine but was denied every gated feature for
 * their entire trial.
 */
const ENTITLED_STATUSES = ["active", "trialing"]

export async function checkFeatureAccess(organizationId: string, feature: FeatureId): Promise<EntitlementResult> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const supabase = await createServiceClient()

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id, status")
      .eq("organization_id", organizationId)
      .single()

    if (!sub || !ENTITLED_STATUSES.includes(sub.status)) {
      return { entitled: false, reason: "No active subscription" }
    }

    const entitled = isEntitled(sub.plan_id, feature)
    return { entitled }
  } catch {
    return { entitled: false, reason: "Error checking entitlement" }
  }
}
