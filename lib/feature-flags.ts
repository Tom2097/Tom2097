
import { createServiceClient } from '@/lib/supabase/service'
import { isEntitled, checkFeatureAccess, type FeatureId } from '@/lib/entitlements/gate'

// Default feature flags (can be overridden by database)
export const DEFAULT_FEATURE_FLAGS = {
  ai_intelligence: true, // Enable AI Intelligence features
  advanced_analytics: true, // Enable advanced analytics
  custom_roles: false, // Enable custom role creation (pending implementation)
  usage_billing: false, // Enable usage-based billing (pending implementation)
  support_tickets: false, // Enable support ticket management (pending implementation)
  document_processing: true, // Enable advanced document processing
  compliance_checks: false, // Enable automated compliance checks (pending implementation)
}

export type FeatureFlag = keyof typeof DEFAULT_FEATURE_FLAGS

// Maps feature flags to their corresponding entitlement feature IDs
export const ENTITLEMENT_FEATURE_MAP: Record<FeatureFlag, FeatureId> = {
  ai_intelligence: "ai_intelligence",
  advanced_analytics: "advanced_analytics",
  custom_roles: "custom_roles",
  usage_billing: "usage_billing",
  support_tickets: "support_tickets",
  document_processing: "document_processing",
  compliance_checks: "compliance_checks",
}

export async function getFeatureFlags(organizationId: string): Promise<Record<FeatureFlag, boolean>> {
  try {
    const supabase = await createServiceClient()
    
    // Check if organization has custom feature flags
    const { data, error } = await supabase
      .from('organization_settings')
      .select('feature_flags')
      .eq('id', organizationId)
      .maybeSingle()
    
    if (error) {
      console.warn('[FeatureFlags] Error fetching feature flags:', error.message)
      return DEFAULT_FEATURE_FLAGS
    }
    
    // Merge default flags with organization-specific overrides
    const merged = { ...DEFAULT_FEATURE_FLAGS, ...(data?.feature_flags || {}) }
    
    // Fetch subscription to check entitlements
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id, status")
      .eq("organization_id", organizationId)
      .maybeSingle()
    
    const planId = sub?.status === "active" ? sub.plan_id : null
    
    // Override flags based on entitlement gating (subscription plan)
    for (const flag of Object.keys(merged) as FeatureFlag[]) {
      const featureId = ENTITLEMENT_FEATURE_MAP[flag]
      if (!isEntitled(planId, featureId)) {
        merged[flag] = false
      }
    }
    
    return merged
  } catch (err) {
    console.error('[FeatureFlags] Unexpected error:', err)
    return DEFAULT_FEATURE_FLAGS
  }
}

export async function setFeatureFlag(
  organizationId: string,
  flag: FeatureFlag,
  value: boolean
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    
    // Get current flags
    const currentFlags = await getFeatureFlags(organizationId)
    
    // Update the specific flag
    const updatedFlags = { ...currentFlags, [flag]: value }
    
    // Save to database
    const { error } = await supabase
      .from('organization_settings')
      .upsert({
        id: organizationId,
        feature_flags: updatedFlags
      })
    
    if (error) {
      console.error('[FeatureFlags] Error setting feature flag:', error.message)
      return false
    }
    
    return true
  } catch (err) {
    console.error('[FeatureFlags] Unexpected error:', err)
    return false
  }
}