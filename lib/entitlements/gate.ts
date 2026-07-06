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

export function getEntitlements(tierId: string): FeatureId[] {
  const plan = getPlanById(tierId)
  if (!plan) return []
  
  const features: FeatureId[] = [
    "crm", "operations", "performance", "resources", "compliance"
  ]
  
  switch (tierId) {
    case "starter":
      features.push("ai_intelligence")
      break
    case "professional":
      features.push(
        "ai_intelligence", "advanced_analytics", "document_processing",
        "workflow_automation", "semantic_search", "api_access",
        "whatsapp_capture", "usage_billing", "support_tickets"
      )
      break
    case "enterprise":
      features.push(
        "ai_intelligence", "advanced_analytics", "document_processing",
        "custom_roles", "usage_billing", "support_tickets",
        "compliance_checks", "workflow_automation", "semantic_search",
        "api_access", "whatsapp_capture", "autonomous_agents",
        "simulation", "white_label", "sso_saml", "audit_export",
        "data_residency", "on_premise"
      )
      break
  }
  
  return [...new Set(features)]
}

export function isEntitled(tierId: string | undefined | null, feature: FeatureId): boolean {
  if (!tierId) return false
  return getEntitlements(tierId).includes(feature)
}

export async function checkFeatureAccess(organizationId: string, feature: FeatureId): Promise<EntitlementResult> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const supabase = await createServiceClient()
    
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id, status")
      .eq("organization_id", organizationId)
      .single()
    
    if (!sub || sub.status !== "active") {
      return { entitled: false, reason: "No active subscription" }
    }
    
    const entitled = isEntitled(sub.plan_id, feature)
    return { entitled }
  } catch {
    return { entitled: false, reason: "Error checking entitlement" }
  }
}
