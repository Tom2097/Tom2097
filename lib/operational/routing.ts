import { classifyText, detectIntent } from "@/lib/analytics/nlp"
import { createServiceClient } from "@/lib/supabase/service"

export type RoutingTarget = "compliance" | "resources" | "performance" | "general"

const CATEGORY_ROUTES: Record<string, RoutingTarget> = {
  legal: "compliance",
  finance: "performance",
  business: "performance",
  technology: "resources",
  health: "compliance",
  science: "resources",
}

export async function classifyAndRoute(
  organizationId: string, documentId: string, content: string,
): Promise<RoutingTarget> {
  const classification = await classifyText(content.slice(0, 5000)).catch(() => null)
  const target = classification?.primary ? (CATEGORY_ROUTES[classification.primary] ?? "general") : "general"

  const intent = await detectIntent(content.slice(0, 3000)).catch(() => null)

  const db = createServiceClient()
  await db.from("documents").update({
    classification: classification?.primary ?? null,
    metadata: { routed_to: target, intent: intent?.primary ?? null },
  }).eq("id", documentId)

  return target
}
