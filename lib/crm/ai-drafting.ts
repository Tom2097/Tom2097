import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createServiceClient } from "@/lib/supabase/service"
import { addTimelineEntry } from "./extensions"

export interface DraftRequest {
  organizationId: string
  userId: string
  contextType: "email" | "proposal" | "follow_up" | "re_engagement" | "meeting_summary" | "cold_email"
  recipientName?: string
  recipientTitle?: string
  companyName?: string
  dealName?: string
  dealStage?: string
  dealValue?: number
  previousInteraction?: string
  tone?: "professional" | "friendly" | "urgent" | "formal"
  keyPoints?: string[]
  contactId?: string
  dealId?: string
}

export interface DraftResult {
  subject: string
  body: string
  alternativeSubject?: string
  wordCount: number
  generatedAt: string
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: "Write in a professional, confident tone. Be direct but courteous.",
  friendly: "Write in a warm, approachable tone. Build rapport naturally.",
  urgent: "Create a gentle sense of urgency. Be clear about timelines without being pushy.",
  formal: "Write in a formal business tone. Use complete sentences and structured paragraphs.",
}

const CONTEXT_PROMPTS: Record<string, string> = {
  email: "Draft a professional email",
  proposal: "Draft a proposal follow-up message",
  follow_up: "Draft a follow-up message for a deal that has gone quiet",
  re_engagement: "Draft a re-engagement message for a cold lead",
  meeting_summary: "Draft a meeting summary and next steps",
  cold_email: "Draft a cold outreach email to a new prospect",
}

export async function draftCrmMessage(
  request: DraftRequest,
): Promise<DraftResult | null> {
  const toneInstruction = TONE_INSTRUCTIONS[request.tone || "professional"]

  const contextParts: string[] = []
  if (request.recipientName) contextParts.push(`Recipient: ${request.recipientName}`)
  if (request.recipientTitle) contextParts.push(`Title: ${request.recipientTitle}`)
  if (request.companyName) contextParts.push(`Company: ${request.companyName}`)
  if (request.dealName) contextParts.push(`Deal: ${request.dealName}`)
  if (request.dealStage) contextParts.push(`Stage: ${request.dealStage}`)
  if (request.dealValue) contextParts.push(`Value: $${request.dealValue.toLocaleString()}`)
  if (request.previousInteraction) contextParts.push(`Previous interaction: ${request.previousInteraction}`)
  if (request.keyPoints?.length) contextParts.push(`Key points to include: ${request.keyPoints.join(", ")}`)

  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a CRM email drafting assistant. You write in the user's voice.
${toneInstruction}
Return ONLY valid JSON with "subject" and "body" fields. The body should use plain text (no markdown).
Keep the subject under 60 characters.`

  const prompt = `${CONTEXT_PROMPTS[request.contextType] || "Draft a message"} with the following context:
${contextParts.join("\n")}

Generate the message:`

  try {
    const result = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: systemPrompt,
      prompt,
      temperature: 0.4,
      maxOutputTokens: 1500,
    })

    let parsed: { subject: string; body: string }
    try {
      parsed = JSON.parse(result.text.trim())
    } catch {
      const lines = result.text.trim().split("\n")
      const subject = lines.find((l) => l.toLowerCase().startsWith("subject"))?.replace(/^subject:\s*/i, "") || "Follow-up"
      const body = lines.filter((l) => !l.toLowerCase().startsWith("subject")).join("\n").trim()
      parsed = { subject, body }
    }

    const draft: DraftResult = {
      subject: parsed.subject,
      body: parsed.body,
      wordCount: parsed.body.split(/\s+/).length,
      generatedAt: new Date().toISOString(),
    }

    if (request.contactId || request.dealId) {
      await addTimelineEntry(request.organizationId, request.userId, {
        entity_type: request.contactId ? "contact" : "deal",
        entity_id: (request.contactId || request.dealId)!,
        entry_type: "note",
        title: `AI Draft: ${draft.subject}`,
        description: draft.body.slice(0, 500),
        metadata: { source: "ai_drafting", draft_length: draft.wordCount, context_type: request.contextType },
      })
    }

    return draft
  } catch {
    return null
  }
}

export async function generateFollowUpCadence(
  organizationId: string,
  userId: string,
  contactName: string,
  dealName: string,
  numberOfSteps: number = 4,
): Promise<Array<{ day: number; subject: string; body: string }>> {
  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: "You are a CRM follow-up sequence generator. Return ONLY valid JSON array.",
    prompt: `Generate a ${numberOfSteps}-step follow-up cadence for:\nContact: ${contactName}\nDeal: ${dealName}\nEach step should have: day (number), subject (string), body (string).\nSpace steps across 14 days.`,
    temperature: 0.4,
    maxOutputTokens: 2000,
  })

  try {
    return JSON.parse(result.text.trim())
  } catch {
    return []
  }
}
