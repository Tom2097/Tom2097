import { createServiceClient } from "@/lib/supabase/service"
import { DEFAULT_FEATURE_FLAGS, type FeatureFlag } from "@/lib/feature-flags"

export interface FeatureFlagDefinition {
  id: FeatureFlag
  name: string
  description: string
  defaultValue: boolean
  category: "ai" | "core" | "compliance" | "billing"
  canaryPercent?: number
  dependsOn?: FeatureFlag[]
}

export const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  { id: "ai_intelligence", name: "AI Intelligence", description: "AI Intelligence features including causal reasoning, daily briefings", defaultValue: true, category: "ai" },
  { id: "advanced_analytics", name: "Advanced Analytics", description: "Advanced analytics and forecasting", defaultValue: true, category: "ai" },
  { id: "document_processing", name: "Document Processing", description: "Advanced document OCR and NLP processing", defaultValue: true, category: "core" },
  { id: "custom_roles", name: "Custom Roles", description: "Custom role creation and permission assignment", defaultValue: false, category: "core" },
  { id: "usage_billing", name: "Usage Billing", description: "Usage-based billing and metering", defaultValue: false, category: "billing" },
  { id: "support_tickets", name: "Support Tickets", description: "Support ticket management system", defaultValue: false, category: "core" },
  { id: "compliance_checks", name: "Compliance Checks", description: "Automated compliance checking and monitoring", defaultValue: false, category: "compliance" },
]

export async function getGlobalFeatureFlags(): Promise<Record<FeatureFlag, boolean>> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from("global_feature_flags")
    .select("*")
    .single()

  if (data?.flags) {
    return { ...DEFAULT_FEATURE_FLAGS, ...(data.flags as Record<string, boolean>) }
  }
  return DEFAULT_FEATURE_FLAGS
}

export async function setGlobalFeatureFlag(
  flag: FeatureFlag,
  value: boolean
): Promise<boolean> {
  const supabase = await createServiceClient()
  const current = await getGlobalFeatureFlags()
  const updated = { ...current, [flag]: value }

  const { error } = await supabase
    .from("global_feature_flags")
    .upsert({ id: "global", flags: updated, updated_at: new Date().toISOString() })

  return !error
}

export async function setKillSwitch(flag: FeatureFlag, enabled: boolean): Promise<boolean> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from("feature_kill_switches")
    .upsert({ flag, killed: !enabled, updated_at: new Date().toISOString() })

  return !error
}

export async function isFeatureKilled(flag: FeatureFlag): Promise<boolean> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from("feature_kill_switches")
    .select("killed")
    .eq("flag", flag)
    .single()

  return data?.killed === true
}

export async function getAllKillSwitches(): Promise<Record<string, boolean>> {
  const supabase = await createServiceClient()
  const { data } = await supabase.from("feature_kill_switches").select("flag, killed")

  const result: Record<string, boolean> = {}
  for (const row of (data as { flag: string; killed: boolean }[] | null) || []) {
    result[row.flag] = row.killed
  }
  return result
}

export async function getCanaryPercentage(flag: FeatureFlag): Promise<number> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from("feature_flag_canary")
    .select("percent")
    .eq("flag", flag)
    .single()

  if (typeof data?.percent === "number") return data.percent
  const def = FEATURE_FLAG_DEFINITIONS.find(d => d.id === flag)
  return def?.canaryPercent || 0
}

export async function setCanaryPercentage(flag: FeatureFlag, percent: number): Promise<boolean> {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from("feature_flag_canary")
    .upsert({ flag, percent: clamped, updated_at: new Date().toISOString() })

  return !error
}

export async function isInCanaryGroup(flag: FeatureFlag, userId: string): Promise<boolean> {
  const percent = await getCanaryPercentage(flag)
  if (percent >= 100) return true
  if (percent <= 0) return false

  const hash = Array.from(userId + flag).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return (hash % 100) < percent
}
