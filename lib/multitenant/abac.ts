import { createServiceClient } from "@/lib/supabase/service"

export type ResourceType =
  | "document" | "compliance_record" | "capa" | "asset" | "inventory_item"
  | "contract" | "report" | "workflow" | "crm_contact" | "crm_deal" | "crm_quote"
  | "analytics_dashboard" | "intelligence_finding" | "audit_log"

export type AccessLevel = "view" | "edit" | "admin" | "deny"

export interface AbacRule {
  id: string
  organization_id: string
  role: string
  resource_type: ResourceType
  access_level: AccessLevel
  conditions: AbacCondition[]
  priority: number
  created_at: string
}

export interface AbacCondition {
  field: string
  operator: "eq" | "neq" | "in" | "not_in" | "contains" | "gt" | "lt" | "gte" | "lte"
  value: unknown
}

export interface AbacEvaluationContext {
  userId: string
  organizationId: string
  role: string
  resourceType: ResourceType
  resourceMetadata: Record<string, unknown>
  userAttributes: Record<string, unknown>
}

export async function evaluateAbac(
  context: AbacEvaluationContext,
): Promise<AccessLevel> {
  const db = createServiceClient()

  const { data: rules } = await db
    .from("abac_rules")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("role", context.role)
    .eq("resource_type", context.resourceType)
    .order("priority", { ascending: true })

  const matched = ((rules ?? []) as AbacRule[]).find((rule) =>
    rule.conditions.length === 0 || rule.conditions.every((c) => evaluateCondition(c, context))
  )

  return matched?.access_level ?? defaultAccessForRole(context.role)
}

function evaluateCondition(
  condition: AbacCondition,
  context: AbacEvaluationContext,
): boolean {
  const resourceVal = context.resourceMetadata[condition.field]
  const userVal = context.userAttributes[condition.field]

  switch (condition.operator) {
    case "eq": return resourceVal === condition.value || userVal === condition.value
    case "neq": return resourceVal !== condition.value && userVal !== condition.value
    case "in": {
      const arr = condition.value as unknown[]
      return arr.includes(resourceVal) || arr.includes(userVal)
    }
    case "not_in": {
      const arr = condition.value as unknown[]
      return !arr.includes(resourceVal) && !arr.includes(userVal)
    }
    case "contains": {
      if (typeof resourceVal === "string" && typeof condition.value === "string") {
        return resourceVal.toLowerCase().includes(condition.value.toLowerCase())
      }
      if (Array.isArray(resourceVal)) {
        return resourceVal.includes(condition.value)
      }
      return false
    }
    case "gt": return Number(resourceVal) > Number(condition.value)
    case "lt": return Number(resourceVal) < Number(condition.value)
    case "gte": return Number(resourceVal) >= Number(condition.value)
    case "lte": return Number(resourceVal) <= Number(condition.value)
    default: return false
  }
}

function defaultAccessForRole(role: string): AccessLevel {
  switch (role) {
    case "admin": return "admin"
    case "member": return "edit"
    case "viewer": return "view"
    default: return "deny"
  }
}

export function canAccess(
  required: AccessLevel,
  granted: AccessLevel,
): boolean {
  if (granted === "deny") return false
  if (granted === "admin") return true
  if (granted === "edit") return required !== "admin"
  if (granted === "view") return required === "view"
  return false
}

export async function createAbacRule(
  organizationId: string,
  role: string,
  resourceType: ResourceType,
  accessLevel: AccessLevel,
  conditions: AbacCondition[] = [],
  priority: number = 100,
): Promise<AbacRule | null> {
  const db = createServiceClient()
  const { data, error } = await db.from("abac_rules").insert({
    organization_id: organizationId,
    role,
    resource_type: resourceType,
    access_level: accessLevel,
    conditions,
    priority,
  }).select("*").single()

  if (error) return null
  return data as AbacRule
}

export async function listAbacRules(
  organizationId: string,
  role?: string,
): Promise<AbacRule[]> {
  const db = createServiceClient()
  let q = db.from("abac_rules").select("*").eq("organization_id", organizationId).order("priority", { ascending: true })
  if (role) q = q.eq("role", role)
  const { data } = await q
  return (data ?? []) as AbacRule[]
}

export async function deleteAbacRule(
  organizationId: string,
  ruleId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from("abac_rules").delete().eq("id", ruleId).eq("organization_id", organizationId)
  return !error
}
