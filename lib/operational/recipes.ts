import { extractFields, INVOICE_SCHEMA, CONTRACT_SCHEMA } from "@/lib/extraction/engine"
import { createServiceClient } from "@/lib/supabase/service"
import { setRenewalReminder } from "@/lib/resources/contracts"
import { createCapa } from "@/lib/compliance/capa"
import { broadcast } from "@/lib/notifications/engine"

export interface Recipe {
  id: string; name: string; description: string; category: string
  trigger_classification: string; steps: RecipeStep[]
  created_by: string | null; created_at: string
}

export interface RecipeStep {
  type: "extract" | "create_record" | "create_task" | "send_notification" | "route" | "reminder"
  config: Record<string, unknown>
}

export const BUILTIN_RECIPES: Omit<Recipe, "id" | "created_by" | "created_at">[] = [
  {
    name: "Invoice Processing", description: "Extract invoice fields → log to payables → flag anomalies",
    category: "finance", trigger_classification: "finance",
    steps: [
      { type: "extract", config: { schema: "invoice" } },
      { type: "create_record", config: { table: "accounts_payable", status: "pending_review" } },
      { type: "send_notification", config: { channel: "notification", message: "Invoice processed - review required" } },
    ],
  },
  {
    name: "Contract Management", description: "Extract terms → set renewal reminder → file in vault",
    category: "legal", trigger_classification: "legal",
    steps: [
      { type: "extract", config: { schema: "contract" } },
      { type: "reminder", config: { days_before: 30 } },
      { type: "route", config: { target: "compliance" } },
    ],
  },
  {
    name: "Meeting Action Items", description: "Extract action items → create tasks → send follow-up",
    category: "operations", trigger_classification: "business",
    steps: [
      { type: "extract", config: { schema: "meeting" } },
      { type: "create_task", config: { type: "action_item" } },
      { type: "send_notification", config: { channel: "email", message: "Follow-up required" } },
    ],
  },
  {
    name: "Inspection Report", description: "Extract findings → create CAPA → notify quality team",
    category: "compliance", trigger_classification: "health",
    steps: [
      { type: "extract", config: { schema: "inspection" } },
      { type: "create_task", config: { type: "capa" } },
      { type: "send_notification", config: { channel: "notification", message: "CAPA created from inspection findings" } },
    ],
  },
]

export async function executeRecipe(
  recipe: Recipe, organizationId: string, documentId: string, content: string, userId: string,
): Promise<string[]> {
  const results: string[] = []
  const db = createServiceClient()

  for (const step of recipe.steps) {
    try {
      switch (step.type) {
        case "extract": {
          const schema = step.config.schema === "invoice" ? INVOICE_SCHEMA : CONTRACT_SCHEMA
          const fields = await extractFields(content.slice(0, 10000), schema)
          await db.from("documents").update({ extracted_entities: fields as unknown as Record<string, unknown> }).eq("id", documentId)
          results.push(`extracted:${fields.length} fields`)
          break
        }
        case "create_record": {
          await db.from(step.config.table as string).insert({
            organization_id: organizationId, document_id: documentId,
            status: step.config.status ?? "pending", source_id: documentId,
          }).maybeSingle()
          results.push(`record_created:${step.config.table}`)
          break
        }
        case "create_task": {
          if (step.config.type === "capa") {
            const capa = await createCapa(organizationId, {
              title: `Recipe: ${recipe.name}`, description: content.slice(0, 1000),
              source: "recipe", severity: "minor",
            }, userId)
            if (capa) results.push(`capa_created:${capa.id}`)
          }
          break
        }
        case "reminder": {
          const { data: doc } = await db.from("documents").select("name, created_at").eq("id", documentId).single()
          if (doc) {
            const expiry = new Date(Date.now() + 365 * 86400000).toISOString()
            await setRenewalReminder(organizationId, documentId, expiry, (step.config.days_before as number) ?? 30)
            results.push("reminder_set")
          }
          break
        }
        case "route": {
          await db.from("documents").update({
            metadata: { routed_to: step.config.target, routed_by: "recipe" },
          }).eq("id", documentId)
          results.push(`routed:${step.config.target}`)
          break
        }
        case "send_notification": {
          await broadcast(organizationId, {
            type: "info",
            category: "recipe_action",
            title: step.config.message as string ?? `Recipe step: ${recipe.name}`,
            data: { document_id: documentId, recipe: recipe.name },
            source: "workflow",
          })
          results.push("notification_sent")
          break
        }
      }
    } catch (err) {
      results.push(`error:${(err as Error).message}`)
    }
  }

  return results
}
