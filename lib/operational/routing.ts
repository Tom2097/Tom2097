import { classifyText, detectIntent } from "@/lib/analytics/nlp"
import { createServiceClient } from "@/lib/supabase/service"

export type RoutingTarget = string // Workspace ID or workspace type

// Default routing rules based on document classification
const DEFAULT_CATEGORY_ROUTES: Record<string, string> = {
  legal: "compliance",
  finance: "performance",
  business: "performance",
  technology: "resources",
  health: "compliance",
  science: "resources",
  healthcare: "healthcare",
  banking: "banking & finance",
  manufacturing: "manufacturing",
  retail: "retail",
  education: "education",
}

// Intent-based routing rules
const INTENT_ROUTES: Record<string, string> = {
  "contract review": "legal",
  "financial report": "banking & finance",
  "patient record": "healthcare",
  "production schedule": "manufacturing",
  "sales report": "retail",
  "student record": "education",
}

export async function classifyAndRoute(
  organizationId: string, documentId: string, content: string,
): Promise<RoutingTarget> {
  // Get organization workspaces to determine available routing targets
  const db = createServiceClient()
  
  // Get organization workspaces
  const { data: workspaces, error: workspacesError } = await db
    .from("workspaces")
    .select("id, vertical")
    .eq("organization_id", organizationId)
  
  if (workspacesError || !workspaces || workspaces.length === 0) {
    console.warn(`No workspaces found for organization ${organizationId}, using default routing`)
    return "general"
  }
  
  // Get organization-specific routing rules
  const { data: routingRules, error: rulesError } = await db
    .from("organization_settings")
    .select("routing_rules")
    .eq("id", organizationId)
    .maybeSingle()
  
  const organizationRules = routingRules?.routing_rules || {}
  
  // Classify document content
  const classification = await classifyText(content.slice(0, 5000)).catch(() => null)
  const intent = await detectIntent(content.slice(0, 3000)).catch(() => null)
  
  // Determine routing target based on classification, intent, and organization rules
  let target: RoutingTarget = "general"
  
  // 1. Check intent-based routing first (highest priority)
  if (intent?.primary) {
    const intentTarget = INTENT_ROUTES[intent.primary.toLowerCase()] || organizationRules.intent?.[intent.primary.toLowerCase()]
    if (intentTarget) {
      // Check if workspace exists for this target
      const workspaceExists = workspaces.some(ws => ws.vertical === intentTarget || ws.id === intentTarget)
      if (workspaceExists) {
        target = intentTarget
      }
    }
  }
  
  // 2. Check classification-based routing if no intent match
  if (target === "general" && classification?.primary) {
    const classificationTarget = DEFAULT_CATEGORY_ROUTES[classification.primary.toLowerCase()] || 
                                organizationRules.categories?.[classification.primary.toLowerCase()]
    
    if (classificationTarget) {
      // Check if workspace exists for this target
      const workspaceExists = workspaces.some(ws => ws.vertical === classificationTarget || ws.id === classificationTarget)
      if (workspaceExists) {
        target = classificationTarget
      }
    }
  }
  
  // 3. Fall back to default workspace if no specific match
  if (target === "general") {
    const defaultWorkspace = workspaces.find(ws => ws.vertical === "general" || ws.id === "general")
    if (defaultWorkspace) {
      target = defaultWorkspace.id
    } else {
      target = workspaces[0].id // Use first workspace as fallback
    }
  }
  
  // The service-role client bypasses RLS, so both mutations must explicitly
  // scope the document to its tenant. Metadata is merged atomically in
  // Postgres to avoid clobbering analysis written by a concurrent pipeline.
  const { error: classificationError } = await db
    .from("documents")
    .update({ classification: classification?.primary ?? null })
    .eq("id", documentId)
    .eq("organization_id", organizationId)

  if (classificationError) throw classificationError

  const { data: mergedMetadata, error: metadataError } = await db.rpc("merge_document_metadata", {
    p_document_id: documentId,
    p_organization_id: organizationId,
    p_patch: {
      routed_to: target,
      intent: intent?.primary ?? null,
      routing_rules_applied: {
        classification: classification?.primary,
        intent: intent?.primary,
        target_workspace: target,
      },
    },
  })

  if (metadataError) throw metadataError
  if (!mergedMetadata) {
    throw new Error("Document not found in organization")
  }

  return target
}

/**
 * Get routing suggestions for a document without actually routing it
 */
export async function getRoutingSuggestions(
  organizationId: string, content: string
): Promise<Array<{ workspaceId: string; workspaceName: string; confidence: number; reason: string }>> {
  const db = createServiceClient()
  
  // Get organization workspaces
  const { data: workspaces, error: workspacesError } = await db
    .from("workspaces")
    .select("id, name, vertical")
    .eq("organization_id", organizationId)
  
  if (workspacesError || !workspaces || workspaces.length === 0) {
    return []
  }
  
  // Get organization-specific routing rules
  const { data: routingRules, error: rulesError } = await db
    .from("organization_settings")
    .select("routing_rules")
    .eq("id", organizationId)
    .maybeSingle()
  
  const organizationRules = routingRules?.routing_rules || {}
  
  // Classify document content
  const classification = await classifyText(content.slice(0, 5000)).catch(() => null)
  const intent = await detectIntent(content.slice(0, 3000)).catch(() => null)
  
  const suggestions: Array<{ workspaceId: string; workspaceName: string; confidence: number; reason: string }> = []
  
  // Check intent-based suggestions
  if (intent?.primary) {
    const intentTarget = INTENT_ROUTES[intent.primary.toLowerCase()] || organizationRules.intent?.[intent.primary.toLowerCase()]
    if (intentTarget) {
      const matchingWorkspaces = workspaces.filter(ws => ws.vertical === intentTarget || ws.id === intentTarget)
      for (const workspace of matchingWorkspaces) {
        suggestions.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          confidence: 0.9, // High confidence for intent matches
          reason: `Document intent matches workspace type: ${intent.primary}`
        })
      }
    }
  }
  
  // Check classification-based suggestions
  if (classification?.primary) {
    const classificationTarget = DEFAULT_CATEGORY_ROUTES[classification.primary.toLowerCase()] || 
                                organizationRules.categories?.[classification.primary.toLowerCase()]
    
    if (classificationTarget) {
      const matchingWorkspaces = workspaces.filter(ws => ws.vertical === classificationTarget || ws.id === classificationTarget)
      for (const workspace of matchingWorkspaces) {
        // Avoid duplicates
        if (!suggestions.some(s => s.workspaceId === workspace.id)) {
          suggestions.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            confidence: 0.7, // Medium confidence for classification matches
            reason: `Document classification matches workspace type: ${classification.primary}`
          })
        }
      }
    }
  }
  
  // Add default suggestions if no specific matches
  if (suggestions.length === 0) {
    for (const workspace of workspaces) {
      suggestions.push({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        confidence: 0.3, // Low confidence for default suggestions
        reason: "Default workspace suggestion"
      })
    }
  }
  
  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Get the currently saved custom routing rules for an organization.
 */
export async function getRoutingRules(
  organizationId: string
): Promise<{ categories: Record<string, string>; intent: Record<string, string> }> {
  const db = createServiceClient()
  const { data } = await db
    .from("organization_settings")
    .select("routing_rules")
    .eq("id", organizationId)
    .maybeSingle()

  const rules = (data?.routing_rules as { categories?: Record<string, string>; intent?: Record<string, string> }) || {}
  return { categories: rules.categories || {}, intent: rules.intent || {} }
}

/**
 * Save custom routing rules for an organization
 */
export async function saveRoutingRules(
  organizationId: string,
  rules: {
    categories?: Record<string, string>,
    intent?: Record<string, string>
  }
): Promise<boolean> {
  const db = createServiceClient()
  
  const { error } = await db
    .from("organization_settings")
    .upsert({
      id: organizationId,
      routing_rules: rules
    })
  
  return !error
}
