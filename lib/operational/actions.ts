import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createServiceClient } from "@/lib/supabase/service"
import { dispatchDocumentEvent } from "@/lib/documents/events"
import { autoCreateTasks } from "@/lib/operational/auto-create"
import { executeRecipe, BUILTIN_RECIPES, type Recipe } from "@/lib/operational/recipes"

/** Thrown by draftResponse when documentId doesn't exist for organizationId, so callers can return a 404 instead of a generic failure. */
export class DocumentNotFoundError extends Error {}

export async function draftResponse(
  organizationId: string, documentId: string, content: string, context?: string,
): Promise<string | null> {
  const db = createServiceClient()

  // Scoped by organization_id so a document belonging to another tenant
  // can't be read (metadata) or written to via a guessed/leaked id. Fetched
  // before calling the model so we don't burn an LLM call on a document
  // that isn't even visible to this org.
  const { data: existing, error: fetchError } = await db
    .from("documents")
    .select("metadata")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (fetchError || !existing) {
    throw new DocumentNotFoundError(`Document ${documentId} not found for organization ${organizationId}`)
  }

  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a business response drafter. Given a document or message, draft an appropriate professional response.
Keep the response concise and actionable. Return ONLY the response text, no JSON.`

  try {
    const result = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: systemPrompt,
      prompt: `Document content:\n"""\n${content.slice(0, 5000)}\n"""\n${context ? `\nContext: ${context}\n` : ""}\n\nDraft a professional response:`,
      temperature: 0.3,
      maxOutputTokens: 1000,
    })

    const response = result.text.trim()

    // Merge into the metadata read above rather than replacing the column
    // outright -- draft_response/draft_generated_at previously clobbered
    // any other metadata (analysis, source, etc.) already stored for this
    // document.
    const existingMetadata = (existing.metadata as Record<string, unknown>) ?? {}
    await db
      .from("documents")
      .update({
        metadata: {
          ...existingMetadata,
          draft_response: response,
          draft_generated_at: new Date().toISOString(),
        },
      })
      .eq("id", documentId)
      .eq("organization_id", organizationId)

    await dispatchDocumentEvent({
      type: "document.created",
      organization_id: organizationId, document_id: documentId, actor_id: null,
      metadata: { action: "draft_response", response_length: response.length },
    })

    return response
  } catch {
    return null
  }
}

export async function triggerAutoActions(
  organizationId: string, documentId: string, content: string, classification: string, userId: string,
): Promise<{ tasks_created: string[]; recipe_results: string[] }> {
  const tasksCreated = await autoCreateTasks(organizationId, documentId, content, classification, userId)

  const matchingRecipe = BUILTIN_RECIPES.find((r) => r.trigger_classification === classification)
  const recipeResults: string[] = []

  if (matchingRecipe) {
    const recipe: Recipe = {
      ...matchingRecipe,
      id: "builtin-" + matchingRecipe.name.toLowerCase().replace(/\s+/g, "-"),
      created_by: userId,
      created_at: new Date().toISOString(),
    }
    const results = await executeRecipe(recipe, organizationId, documentId, content, userId)
    recipeResults.push(...results)
  }

  return { tasks_created: tasksCreated, recipe_results: recipeResults }
}

export async function triggerWorkflowFromDocument(
  organizationId: string, documentId: string, content: string, workflowId: string,
): Promise<boolean> {
  const { documentToWorkflow } = await import("@/lib/operational/doc-to-workflow")
  const ctx = await import("@/lib/multitenant/context")

  const db = createServiceClient()
  const { data: workflow } = await db.from("workflows").select("*").eq("id", workflowId).single()
  if (!workflow) return false

  const result = await documentToWorkflow(organizationId, "system", content, "trigger")
  if (!result.workflow_id) return false

  await dispatchDocumentEvent({
    type: "document.triggered",
    organization_id: organizationId, document_id: documentId, actor_id: null,
    metadata: { workflow_id: workflowId, steps_generated: result.steps_generated },
  })

  return true
}
