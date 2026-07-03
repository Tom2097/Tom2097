import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createWorkflow } from "@/lib/workflows/store"
import type { WorkflowStep, WorkflowTrigger } from "@/lib/workflows/types"

export async function documentToWorkflow(
  organizationId: string, userId: string, content: string, docName: string,
): Promise<{ workflow_id: string | null; steps_generated: number }> {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a workflow builder. Given a document (SOP, process description, standard operating procedure), 
generate a runnable workflow with steps. Each step has a type (action, notification, approval, delay, condition)
and a label.

Return ONLY a JSON object:
{
  "name": "Generated Workflow Name",
  "description": "What this workflow does",
  "steps": [
    { "type": "action", "label": "Step 1", "config": { "task": "description" } },
    { "type": "notification", "label": "Notify", "config": { "channel": "email" } },
    { "type": "approval", "label": "Get approval", "config": {} },
    { "type": "delay", "label": "Wait", "config": { "duration_hours": 24 } }
  ],
  "trigger_type": "event",
  "trigger_event": "operational.document_ingested"
}`

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL, system: systemPrompt,
    prompt: `Document (${docName}):\n"""\n${content.slice(0, 10000)}\n"""\n\nGenerate workflow:`,
    temperature: 0.2, maxOutputTokens: 2000,
  })

  try {
    const m = result.text.match(/\{[\s\S]*\}/)
    if (!m) return { workflow_id: null, steps_generated: 0 }

    const parsed = JSON.parse(m[0])
    const steps: WorkflowStep[] = (parsed.steps ?? []).map((s: unknown, i: number) => {
      const step = s as WorkflowStep;
      return {
        id: `step-${i + 1}`,
        type: step.type,
        label: step.label,
        config: step.config ?? {},
        order: i + 1,
      };
    })

    const trigger: WorkflowTrigger = {
      type: parsed.trigger_type === "schedule" ? "schedule" : "event",
      event: parsed.trigger_event ?? "operational.document_ingested",
    }

    const workflow = await createWorkflow(organizationId, userId, {
      name: parsed.name ?? `Workflow from ${docName}`,
      description: parsed.description ?? null,
      trigger,
      steps,
      enabled: false,
    })

    return { workflow_id: workflow?.id ?? null, steps_generated: steps.length }
  } catch {
    return { workflow_id: null, steps_generated: 0 }
  }
}
