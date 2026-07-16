import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"

const CopilotResponseSchema = z.object({
  response: z.string().describe("Conversational reply to the user"),
  action: z
    .object({
      type: z.enum(["create_task", "log_capa", "notify_team"]).describe(
        "create_task: a follow-up task should be tracked. log_capa: a quality/compliance issue should be logged as a corrective action. notify_team: the team should be alerted."
      ),
      label: z.string().describe("Short button label, e.g. 'Create Task'"),
      details: z.string().describe("What the action will actually do, in one sentence"),
    })
    .optional()
    .describe("Only include when the user's message clearly calls for one of these concrete follow-up actions"),
})

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractTenantContext()
    if (!ctx?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { message, history } = await request.json()
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const historyText = Array.isArray(history)
      ? history.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join("\n")
      : ""

    const { object } = await generateObject({
      model: DEFAULT_CHAT_MODEL,
      schema: CopilotResponseSchema,
      system: `${BASE_SYSTEM_PROMPT}\nYou are an operational copilot that helps users process documents, extract data, create tasks, and trigger workflows. Only suggest an action when the user's request genuinely calls for tracking a task, logging a compliance issue, or alerting the team -- most messages don't need one.`,
      prompt: `${historyText}\nuser: ${message}\nassistant:`,
    })

    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
  }
}
